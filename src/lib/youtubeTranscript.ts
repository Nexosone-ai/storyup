/**
 * 유튜브 영상 원고 가져오기 — 블로그 '참조 자료'에 유튜브 링크를 넣으면 말한 내용을 글감으로 쓴다(2026-11-12).
 * 1) 공개 watch 페이지의 captionTracks(수동 자막 우선 → 자동 생성 자막)를 읽어 본다(무료·정확).
 *    단, 유튜브가 자막 본문(timedtext)을 빈 응답으로 주는 경우가 많아(2026-11 기준 브라우저 밖 요청 전부)
 * 2) Gemini 공식 API 의 유튜브 영상 입력(file_data.file_uri)으로 전사한다(공개 영상만, 앞 30분까지).
 * 서버에서만 호출(네트워크). 비공개·삭제·연령 제한 영상은 YoutubeTranscriptError.
 */
/** 유튜브 URL(여러 형식)에서 11자 영상 ID 추출 — similarVideo.ts 와 같은 규칙(이 모듈은 server-only 의존 없이 테스트 가능). */
export function parseYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/\/(?:shorts|embed|v|live)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

export class YoutubeTranscriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YoutubeTranscriptError";
  }
}

export interface YoutubeTranscript {
  videoId: string;
  title: string;
  /** 자막 언어 코드(ko·en …). */
  lang: string;
  /** 자동 생성 자막(asr)인지. */
  auto: boolean;
  text: string;
  /** 어떻게 얻었는지 — captions(자막 파일) | gemini(영상 전사). */
  via: "captions" | "gemini";
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // "asr" = 자동 생성
  name?: { simpleText?: string; runs?: { text: string }[] };
}

const MAX_CHARS = 20_000;
/** Gemini 전사 상한(초) — 긴 영상은 앞부분만 읽는다(비용·시간 상한). */
const GEMINI_MAX_SECONDS = 1800;
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = process.env.GEMINI_VIDEO_MODEL || process.env.GEMINI_STT_MODEL || "gemini-3.6-flash";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchText(url: string, timeoutMs = 12_000, headers: Record<string, string> = {}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "user-agent": UA,
        "accept-language": "ko,en;q=0.8",
        cookie: "CONSENT=YES+cb; SOCS=CAI",
        ...headers,
      },
    });
    if (!res.ok) throw new YoutubeTranscriptError(`유튜브 응답 오류(${res.status}).`);
    return await res.text();
  } catch (err) {
    if (err instanceof YoutubeTranscriptError) throw err;
    throw new YoutubeTranscriptError("유튜브 페이지를 가져오지 못했어요(시간 초과·차단).");
  } finally {
    clearTimeout(timer);
  }
}

/** watch 페이지 HTML 에서 captionTracks 배열과 제목을 뽑는다. */
function parseWatchPage(html: string): { tracks: CaptionTrack[]; title: string; unavailable: string | null } {
  // 제목 — videoDetails.title 우선, 없으면 <title>.
  const vd = html.match(/"videoDetails":\{[\s\S]*?"title":"((?:[^"\\]|\\.)*)"/);
  const titleTag = html.match(/<title>([^<]*)<\/title>/i);
  const title = (vd?.[1] ? JSON.parse(`"${vd[1]}"`) : (titleTag?.[1] ?? "").replace(/\s*-\s*YouTube\s*$/i, ""))
    .toString()
    .trim();

  // 재생 불가 사유(비공개·삭제·연령 제한).
  let unavailable: string | null = null;
  const status = html.match(/"playabilityStatus":\{"status":"([A-Z_]+)"(?:,"reason":"((?:[^"\\]|\\.)*)")?/);
  if (status && status[1] !== "OK") unavailable = status[2] ? JSON.parse(`"${status[2]}"`) : status[1];

  const m = html.match(/"captionTracks":(\[[\s\S]*?\])(?=,"audioTracks"|,"translationLanguages"|\})/);
  if (!m) return { tracks: [], title, unavailable };
  try {
    const arr = JSON.parse(m[1]) as CaptionTrack[];
    return { tracks: arr.filter((t) => t && typeof t.baseUrl === "string"), title, unavailable };
  } catch {
    return { tracks: [], title, unavailable };
  }
}

/** 선호 언어(수동 자막 우선) → 자동 자막 → 첫 트랙. */
function pickTrack(tracks: CaptionTrack[], prefer: string[]): CaptionTrack | null {
  const lang = (t: CaptionTrack) => (t.languageCode || "").toLowerCase().split("-")[0];
  for (const p of prefer) {
    const manual = tracks.find((t) => lang(t) === p && t.kind !== "asr");
    if (manual) return manual;
  }
  for (const p of prefer) {
    const auto = tracks.find((t) => lang(t) === p);
    if (auto) return auto;
  }
  return tracks.find((t) => t.kind !== "asr") ?? tracks[0] ?? null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** json3(events/segs) 또는 timedtext XML(<text>) 을 평문으로. */
function captionsToText(body: string): string {
  const trimmed = body.trim();
  let parts: string[] = [];
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed) as { events?: { segs?: { utf8?: string }[] }[] };
      parts = (j.events ?? []).map((e) => (e.segs ?? []).map((s) => s.utf8 ?? "").join(""));
    } catch {
      parts = [];
    }
  } else {
    parts = [...trimmed.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => decodeEntities(m[1]));
  }
  return parts
    .join(" ")
    .replace(/\[(음악|박수|웃음|Music|Applause|Laughter)\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 공개 oEmbed 로 제목만 — 실패하면 null(제목은 보조 정보). */
async function fetchOembedTitle(videoId: string): Promise<string | null> {
  try {
    const raw = await fetchText(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      8_000,
    );
    const j = JSON.parse(raw) as { title?: string };
    return typeof j.title === "string" && j.title.trim() ? j.title.trim() : null;
  } catch {
    return null;
  }
}

/** 1단계: 자막 파일. 자막이 없거나 본문이 비어 있으면 null(→ Gemini 폴백). 비공개 등은 throw. */
async function transcriptFromCaptions(
  videoId: string,
  prefer: string[],
): Promise<{ title: string; result: Omit<YoutubeTranscript, "title"> | null }> {
  let html = "";
  try {
    html = await fetchText(`https://www.youtube.com/watch?v=${videoId}&hl=ko&has_verified=1`);
  } catch {
    return { title: "", result: null };
  }
  const { tracks, title, unavailable } = parseWatchPage(html);
  if (tracks.length === 0) {
    if (unavailable && /PRIVATE|ERROR|UNPLAYABLE|AGE/i.test(unavailable))
      throw new YoutubeTranscriptError(`영상을 볼 수 없어요(${unavailable}). 공개 영상 링크를 넣어주세요.`);
    return { title, result: null };
  }
  const track = pickTrack(tracks, prefer)!;
  const base = track.baseUrl.replace(/&fmt=[^&]*/g, "");
  let text = "";
  for (const u of [`${base}&fmt=json3`, base]) {
    try {
      text = captionsToText(await fetchText(u));
    } catch {
      text = "";
    }
    if (text) break;
  }
  if (text.length < 40) return { title, result: null };
  return {
    title,
    result: {
      videoId,
      lang: track.languageCode,
      auto: track.kind === "asr",
      text: text.slice(0, MAX_CHARS),
      via: "captions",
    },
  };
}

/** 2단계: Gemini 영상 입력으로 전사(공식 API, 공개 영상만). */
async function transcriptFromGemini(videoId: string): Promise<Omit<YoutubeTranscript, "title">> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new YoutubeTranscriptError("영상 원고 읽기가 설정되지 않았어요(GEMINI_API_KEY 누락).");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110_000);
  let res: Response;
  let json: {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string; status?: string };
  };
  try {
    res = await fetch(`${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                file_data: { file_uri: `https://www.youtube.com/watch?v=${videoId}` },
                video_metadata: { end_offset: `${GEMINI_MAX_SECONDS}s` },
              },
              {
                text: `이 영상에서 말한 내용을 전사하세요.
- 말한 언어 그대로 작성(번역 금지). 화면 자막·설명은 쓰지 말고 말소리만.
- "음", "어" 같은 추임새는 제외하고 문장 부호를 넣어 자연스러운 문장으로.
- 타임스탬프·화자 표시·설명·인사 없이 전사문만.
- 말소리가 전혀 없으면 빈 문자열만 반환.`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    });
    json = (await res.json()) as typeof json;
  } catch {
    throw new YoutubeTranscriptError("영상 원고를 읽는 데 시간이 너무 걸려요. 더 짧은 영상이나 잠시 후 다시 시도해주세요.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const msg = json.error?.message ?? "";
    console.error("[youtubeTranscript] gemini", res.status, msg);
    if (res.status === 429 || res.status >= 500)
      throw new YoutubeTranscriptError("영상 원고 서버가 혼잡해요. 잠시 후 다시 시도해주세요.");
    // 403/404 는 영상을 못 찾거나 접근 불가(없는 ID·비공개) 일 때 Gemini 가 주는 응답.
    if (res.status === 403 || res.status === 404 || /video|youtube|file_uri|unsupported|not found|private|unavailable/i.test(msg))
      throw new YoutubeTranscriptError(
        "이 영상은 읽을 수 없어요(비공개·삭제·연령 제한·회원 전용). 공개 영상 링크를 넣어주세요.",
      );
    throw new YoutubeTranscriptError(`영상 원고를 읽지 못했어요(${res.status}).`);
  }
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 40)
    throw new YoutubeTranscriptError(
      "영상에서 말소리를 찾지 못했어요(음악·무음 영상). 원고를 파일로 첨부하거나 다른 영상을 써주세요.",
    );
  return { videoId, lang: "auto", auto: true, text: text.slice(0, MAX_CHARS), via: "gemini" };
}

/**
 * 유튜브 링크 → 원고 텍스트. 자막 파일(prefer 순서, 기본 한국어 → 영어)을 먼저 시도하고,
 * 못 읽으면 Gemini 영상 전사로 폴백한다. 비공개·무음 등은 YoutubeTranscriptError.
 */
export async function fetchYoutubeTranscript(
  url: string,
  prefer: string[] = ["ko", "en"],
): Promise<YoutubeTranscript> {
  const videoId = parseYoutubeVideoId(url);
  if (!videoId) throw new YoutubeTranscriptError("유튜브 영상 링크가 아니에요.");

  const [captions, oembedTitle] = await Promise.all([
    transcriptFromCaptions(videoId, prefer),
    fetchOembedTitle(videoId),
  ]);
  const title = oembedTitle || captions.title || `YouTube ${videoId}`;
  if (captions.result) return { ...captions.result, title };
  return { ...(await transcriptFromGemini(videoId)), title };
}
