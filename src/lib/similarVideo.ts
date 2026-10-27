import "server-only";

/**
 * 파트너 '유사 영상 10개' 생성 보조 — 원본 영상 URL에서 참고용 썸네일을 뽑고,
 * 컨셉 1줄을 서로 다른 10가지 '시네마틱 변주' 프롬프트로 펼친다.
 * 실제 생성은 기존 fal.ai 엔진(src/lib/video.ts submitVideo)이 담당한다. 서버 전용.
 */

export const SIMILAR_VIDEO_COUNT = 10;

/** 파트너 패킷 차감 액션 키 — partner_credit_prices.action 과 일치(관리자 단가). */
export const SIMILAR_VIDEO_ACTION = "SIMILAR_VIDEO";

/** 유튜브 URL(여러 형식)에서 11자 영상 ID 추출. 아니면 null. */
export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      // /shorts/{id}, /embed/{id}, /v/{id}
      const m = u.pathname.match(/\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

/** 유튜브 영상 ID → 공개 썸네일 URL(image-to-video 참고 프레임으로 사용). */
export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** http(s) URL인지 가볍게 검증. */
export function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** 비율 → 방향 힌트(프롬프트 보강용). */
function orientationHint(aspect: string): string {
  if (aspect === "16:9") return "horizontal 16:9 widescreen video";
  if (aspect === "1:1") return "square 1:1 video";
  return "vertical 9:16 short-form video";
}

/**
 * 10가지 '같은 컨셉, 다른 연출' 변주 — 앵글·조명·시간대·무드·카메라 무빙을 다르게.
 * 각 변주가 충분히 구별되도록 영어 시네마틱 지시문으로 작성한다.
 */
const VARIATIONS: string[] = [
  "cinematic wide establishing shot, warm golden-hour light, slow dolly-in",
  "intimate close-up detail shot, soft natural daylight, shallow depth of field",
  "dynamic tracking shot, bright and energetic mood, smooth lateral camera pan",
  "top-down overhead angle, clean minimal styling, gentle slow zoom",
  "handheld documentary style, cozy ambient evening light, subtle organic motion",
  "vibrant high-contrast look, playful quick push-in, lively upbeat mood",
  "elegant slow-motion, premium cinematic color grade, soft bokeh background",
  "confident low-angle hero shot, dramatic directional lighting, steady move",
  "airy bright lifestyle vibe, soft pastel tones, gently floating camera",
  "moody atmospheric tone, rim lighting, cinematic slow reveal",
];

export interface VariationPrompt {
  idx: number;
  prompt: string;
}

/**
 * 컨셉(한국어 가능) + 비율 → 서로 다른 10개 프롬프트.
 * 컨셉은 그대로 두고 영어 연출 지시문을 덧붙여 fal 모델이 변주를 만들게 한다.
 */
export function buildVariationPrompts(
  concept: string,
  aspect: string,
  count = SIMILAR_VIDEO_COUNT,
): VariationPrompt[] {
  const base = concept.trim().slice(0, 500) || "a short promotional lifestyle video";
  const orient = orientationHint(aspect);
  const n = Math.max(1, Math.min(count, VARIATIONS.length));
  return Array.from({ length: n }, (_, i) => ({
    idx: i,
    prompt: `${base} — ${VARIATIONS[i]}. ${orient}, high quality, no on-screen text`.slice(
      0,
      1000,
    ),
  }));
}
