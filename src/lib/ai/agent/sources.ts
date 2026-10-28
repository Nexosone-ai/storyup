import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * 오토파일럿 블로그 '글감 소스' — URL/PDF에서 추출한 텍스트를 보관·활용한다.
 * URL은 서버에서 안전하게 가져와 본문 텍스트만 뽑고, PDF는 브라우저에서 추출한
 * 텍스트를 받아 저장한다(큰 바이트가 서버 본문 한도를 거치지 않도록).
 */

/** 소스 1건당 저장 상한(글자). */
export const MAX_SOURCE_CHARS = 20_000;
/** 생성 프롬프트에 넣는 결합 상한(글자). */
export const MAX_COMBINED_CHARS = 12_000;
/** 사업장당 소스 최대 개수. */
export const MAX_SOURCES = 10;

type SourceRow = Database["public"]["Tables"]["agent_blog_sources"]["Row"];

export class SourceFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceFetchError";
  }
}

/** 내부망/로컬/메타데이터 주소로의 요청을 막는다(SSRF 방지). http/https만 허용.
 *  URL 파싱·검증만 하고 네트워크 요청은 하지 않는다(참고 URL 저장 검증에도 재사용). */
export function assertPublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SourceFetchError("올바른 URL이 아니에요.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new SourceFetchError("http/https 주소만 쓸 수 있어요.");
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  )
    throw new SourceFetchError("내부 주소는 가져올 수 없어요.");
  // IP 리터럴이면 사설/루프백/링크로컬 차단.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    const isPrivate =
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168);
    if (isPrivate) throw new SourceFetchError("사설 IP는 가져올 수 없어요.");
  }
  if (host === "[::1]" || host.startsWith("[fc") || host.startsWith("[fd"))
    throw new SourceFetchError("내부 주소는 가져올 수 없어요.");
  return u;
}

/** 아주 단순한 HTML → 텍스트 변환(스크립트/스타일 제거, 태그 제거, 공백 정리). */
function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeEntities((titleMatch?.[1] ?? "").trim()).slice(0, 200);
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .replace(/^\s+|\s+$/gm, "")
    .trim();
  return { title, text };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** URL을 안전하게 가져와 본문 텍스트를 추출한다. 실패 시 SourceFetchError. */
export async function extractUrlText(
  raw: string,
): Promise<{ title: string; text: string; url: string }> {
  const u = assertPublicUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; StoryupBot/1.0)",
        accept: "text/html,application/xhtml+xml,text/plain",
      },
      cache: "no-store",
    });
  } catch {
    clearTimeout(timer);
    throw new SourceFetchError("페이지를 가져오지 못했어요(시간 초과·차단).");
  }
  clearTimeout(timer);
  if (!res.ok) throw new SourceFetchError(`페이지 응답 오류(${res.status}).`);
  const ctype = res.headers.get("content-type") ?? "";
  if (!/text\/html|text\/plain|application\/xhtml/i.test(ctype))
    throw new SourceFetchError("웹페이지(HTML) 주소만 지원해요. PDF는 파일로 올려주세요.");

  // 최대 2MB만 읽는다.
  const raw2 = await res.text();
  const html = raw2.slice(0, 2_000_000);
  const { title, text } =
    /text\/plain/i.test(ctype)
      ? { title: u.hostname, text: html }
      : htmlToText(html);
  if (text.trim().length < 80)
    throw new SourceFetchError("본문 텍스트가 너무 적어요. 다른 주소를 써보세요.");
  return {
    title: title || u.hostname,
    text: text.slice(0, MAX_SOURCE_CHARS),
    url: u.toString(),
  };
}

/** 사업장의 소스들을 하나의 글감 텍스트로 결합(상한 적용). */
export async function loadCombinedSources(
  admin: SupabaseClient<Database>,
  businessId: string,
): Promise<{ text: string; count: number }> {
  const { data } = await admin
    .from("agent_blog_sources")
    .select("kind, title, text, url")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(MAX_SOURCES);
  const rows = (data ?? []) as Pick<SourceRow, "kind" | "title" | "text" | "url">[];
  if (rows.length === 0) return { text: "", count: 0 };

  let combined = "";
  for (const r of rows) {
    if (combined.length >= MAX_COMBINED_CHARS) break;
    const head = `[${r.kind === "url" ? "웹" : "PDF"}] ${r.title}${
      r.url ? ` (${r.url})` : ""
    }\n`;
    const remain = MAX_COMBINED_CHARS - combined.length;
    combined += (head + r.text).slice(0, remain) + "\n\n";
  }
  return { text: combined.trim(), count: rows.length };
}
