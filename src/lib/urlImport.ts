import "server-only";
import net from "node:net";
import dns from "node:dns/promises";

/**
 * URL 랜딩페이지 불러오기 — 사용자가 입력한 웹주소에서 본문 텍스트와 사진 URL을
 * 뽑아낸다. 서버에서 직접 fetch하므로 SSRF(내부망·메타데이터 접근)를 반드시 차단한다:
 * http/https만 허용, 호스트를 DNS로 실제 해석해 사설/루프백/링크로컬 대역이면 거부,
 * 리디렉션은 매 홉마다 다시 검증, 응답 크기·시간 상한을 둔다.
 * 파서는 의존성 없이 정규식으로 처리한다(프로젝트 관례). scene/본문은 AI가 요약한다.
 */

/** 사용자에게 그대로 보여줄 수 있는 메시지를 가진 오류. */
export class UrlImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlImportError";
  }
}

export const URL_HTML_MAX_BYTES = 3 * 1024 * 1024; // 3MB — 본문 HTML 상한
const IMG_MAX_BYTES = 8 * 1024 * 1024; // 8MB — 이미지 1장 상한
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
const MAX_IMAGE_CANDIDATES = 10;
const MAX_TEXT_CHARS = 12_000;
const UA =
  "Mozilla/5.0 (compatible; StoryUpBot/1.0; +https://storyup.me) AppleWebKit/537.36";

export interface UrlPageExtract {
  /** <title>/og:site_name에서 추정한 사업체·사이트 이름 */
  name: string;
  /** meta description/og:description */
  description: string;
  /** 태그를 제거한 본문 텍스트(상한 적용) */
  text: string;
  /** 절대 URL로 정규화한 사진 후보(중복·아이콘 제거) */
  images: string[];
  /** 최종 도달 주소 */
  siteUrl: string;
}

/** IPv4/IPv6가 사설·루프백·링크로컬 등 '외부가 아닌' 대역이면 true. */
function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    const [a, b] = p;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // 링크로컬(메타데이터 169.254.169.254 포함)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // 멀티캐스트/예약
    return false;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase().replace(/^\[|\]$/g, "");
    if (l === "::1" || l === "::") return true;
    if (l.startsWith("fe80")) return true; // 링크로컬
    if (l.startsWith("fc") || l.startsWith("fd")) return true; // ULA fc00::/7
    const mapped = l.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return false;
  }
  return true; // 알 수 없는 형식 → 안전상 차단
}

/** http/https + 공인 IP로 해석되는 주소인지 검증한다. 아니면 UrlImportError. */
async function assertPublicUrl(u: URL): Promise<void> {
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new UrlImportError("http 또는 https 주소만 불러올 수 있습니다.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || /^(localhost|.*\.local|.*\.internal)$/i.test(host))
    throw new UrlImportError("이 주소는 불러올 수 없습니다.");
  // 호스트가 이미 IP면 그대로, 아니면 DNS로 해석해 모든 결과를 검사.
  const literals =
    net.isIP(host) !== 0 ? [host] : (await resolveHost(host)).map((a) => a);
  if (literals.length === 0)
    throw new UrlImportError("주소를 찾을 수 없습니다. 주소를 확인해주세요.");
  for (const ip of literals)
    if (isBlockedIp(ip))
      throw new UrlImportError("내부망 주소는 불러올 수 없습니다.");
}

async function resolveHost(host: string): Promise<string[]> {
  try {
    const recs = await dns.lookup(host, { all: true });
    return recs.map((r) => r.address);
  } catch {
    throw new UrlImportError("주소를 찾을 수 없습니다. 주소를 확인해주세요.");
  }
}

/** 응답 본문을 상한까지만 읽는다(대용량 다운로드 방지). */
async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const len = Number(res.headers.get("content-length") || 0);
  if (len && len > maxBytes)
    throw new UrlImportError("자료가 너무 큽니다.");
  const reader = res.body?.getReader();
  if (!reader) {
    const ab = await res.arrayBuffer();
    return Buffer.from(ab).subarray(0, maxBytes);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(Buffer.from(value));
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* noop */
      }
      break;
    }
  }
  return Buffer.concat(chunks).subarray(0, maxBytes);
}

/** 리디렉션을 매 홉 재검증하며 안전하게 fetch한다. */
async function safeFetch(
  startUrl: URL,
  accept: string,
  maxBytes: number,
): Promise<{ buf: Buffer; contentType: string; finalUrl: URL }> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": UA, accept },
      });
    } catch {
      throw new UrlImportError(
        "주소에 접속하지 못했습니다. 주소를 확인하거나 잠시 후 다시 시도해주세요.",
      );
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) throw new UrlImportError("주소를 불러오지 못했습니다.");
      try {
        current = new URL(loc, current);
      } catch {
        throw new UrlImportError("주소를 불러오지 못했습니다.");
      }
      continue;
    }
    if (!res.ok)
      throw new UrlImportError(
        res.status === 404
          ? "해당 주소에서 내용을 찾을 수 없습니다 (404)."
          : "주소를 불러오지 못했습니다. 주소를 확인해주세요.",
      );
    const buf = await readCapped(res, maxBytes);
    return {
      buf,
      contentType: res.headers.get("content-type") || "",
      finalUrl: current,
    };
  }
  throw new UrlImportError("리디렉션이 너무 많습니다.");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
  "#x2F": "/",
  "#47": "/",
};
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, ent: string) => {
    if (ENTITIES[ent]) return ENTITIES[ent];
    if (ent[0] === "#") {
      const code =
        ent[1] === "x" || ent[1] === "X"
          ? parseInt(ent.slice(2), 16)
          : parseInt(ent.slice(1), 10);
      if (Number.isFinite(code)) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return m;
        }
      }
    }
    return m;
  });
}

/** <script>/<style> 등을 걷어내고 태그를 제거해 읽을 수 있는 본문만 남긴다. */
function htmlToText(html: string): string {
  const body =
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr|header|footer)>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  return decodeEntities(body)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

function firstMatch(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : "";
}

/** <meta property/name="key" content="..."> 값을 뽑는다(속성 순서 무관). */
function metaContent(html: string, key: string): string {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${esc}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const v = firstMatch(html, re);
    if (v) return v;
  }
  return "";
}

const IMG_SKIP =
  /(logo|sprite|icon|favicon|placeholder|blank|pixel|spacer|avatar|loading|\.svg(\?|$)|\.ico(\?|$)|\.gif(\?|$)|data:)/i;

/** 페이지에서 사진 후보 URL을 절대경로로 모은다(아이콘·중복 제거). */
function extractImages(html: string, base: URL): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | undefined) => {
    if (!raw || out.length >= MAX_IMAGE_CANDIDATES) return;
    const first = raw.split(/[ ,]/)[0].trim(); // srcset 대응
    if (!first || first.startsWith("data:")) return;
    let abs: string;
    try {
      abs = new URL(first, base).toString();
    } catch {
      return;
    }
    if (IMG_SKIP.test(abs) || seen.has(abs)) return;
    seen.add(abs);
    out.push(abs);
  };

  // og:image 우선
  push(metaContent(html, "og:image"));
  push(metaContent(html, "twitter:image"));
  // 본문 <img>
  const imgRe = /<img\b[^>]*?\b(?:data-src|srcset|src)=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) && out.length < MAX_IMAGE_CANDIDATES) push(m[1]);
  return out;
}

/** 사용자가 입력한 주소를 정규화한다(프로토콜 생략 시 https 보정). */
function normalizeInput(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new UrlImportError("주소를 입력해주세요.");
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProto);
  } catch {
    throw new UrlImportError("올바른 주소가 아닙니다. 예: https://example.com");
  }
}

/** 주소에서 랜딩페이지 구성용 원문(텍스트·사진 URL·메타)을 가져온다. */
export async function fetchLandingSource(rawUrl: string): Promise<UrlPageExtract> {
  const start = normalizeInput(rawUrl);
  const { buf, contentType, finalUrl } = await safeFetch(
    start,
    "text/html,application/xhtml+xml",
    URL_HTML_MAX_BYTES,
  );
  if (contentType && !/html|xml|text\/plain/i.test(contentType))
    throw new UrlImportError(
      "웹페이지(HTML) 주소만 불러올 수 있습니다. 홈페이지 주소를 입력해주세요.",
    );
  const html = buf.toString("utf8");
  const title =
    metaContent(html, "og:site_name") ||
    firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
    metaContent(html, "og:title");
  const description =
    metaContent(html, "description") || metaContent(html, "og:description");
  const text = htmlToText(html);
  if (text.length < 40)
    throw new UrlImportError(
      "이 주소에서 읽을 수 있는 내용이 거의 없습니다. 다른 주소를 시도해주세요.",
    );
  return {
    name: title.replace(/\s*[|·\-–—]\s*.*$/, "").trim() || title,
    description,
    text,
    images: extractImages(html, finalUrl),
    siteUrl: finalUrl.toString(),
  };
}

/** 사진 후보 URL들을 안전하게 내려받아 바이트로 돌려준다(SSRF 재검증·크기 상한). */
export async function fetchImageBuffers(
  urls: string[],
  max: number,
): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (const u of urls.slice(0, MAX_IMAGE_CANDIDATES)) {
    if (out.length >= max) break;
    try {
      const { buf, contentType } = await safeFetch(
        new URL(u),
        "image/*",
        IMG_MAX_BYTES,
      );
      if (contentType && !/^image\//i.test(contentType)) continue;
      if (buf.length > 0) out.push(buf);
    } catch {
      // 개별 이미지 실패는 건너뛴다(전체 불러오기를 막지 않음).
    }
  }
  return out;
}
