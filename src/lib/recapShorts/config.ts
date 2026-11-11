/**
 * 파트너 '블로그 글감 → 요약 쇼츠'(Recap Shorts) 플래그 + 상수.
 *
 * 기본 '켜짐' — 끄려면 환경변수 NEXT_PUBLIC_RECAP_SHORTS_ENABLED=false (쇼츠·채널광고와 동일 패턴).
 * 전제: 마이그 0100 적용·GEMINI_API_KEY·ANTHROPIC_API_KEY. 키가 없으면 UI에 '설정 필요'로 표시된다.
 * 파이프라인: Claude 대본 → Gemini TTS(장면별) → 이미지(카드뉴스 배경 재사용 | AI) → 브라우저 렌더.
 */
export const RECAP_SHORTS_ENABLED =
  process.env.NEXT_PUBLIC_RECAP_SHORTS_ENABLED !== "false";

/** 작업권 서비스 키(entitlement_services, 0112) — 1편당 RECAP_SHORTS 1. */
export const RECAP_SHORTS_ACTION = "RECAP_SHORTS" as const;
/** AI 장면 이미지는 장당 EXTRA_IMAGE 작업권 1. */
export const RECAP_IMAGE_ACTION = "EXTRA_IMAGE" as const;

export const RECAP_SCENE_MIN = 5;
export const RECAP_SCENE_MAX = 7;
/** 목표 총 길이(초) — 대본 분량 가이드용. */
export const RECAP_TARGET_SEC = 35;

/** Gemini TTS 프리셋 보이스(일부) + 한글 라벨. 기본은 저장소 기본과 같은 Charon. */
export const RECAP_VOICES: { id: string; label: string; desc: string }[] = [
  { id: "Charon", label: "차론", desc: "차분한 남성, 정보 전달형" },
  { id: "Kore", label: "코레", desc: "또렷한 여성, 밝고 명확" },
  { id: "Puck", label: "퍽", desc: "경쾌한 남성, 친근함" },
  { id: "Aoede", label: "아오이데", desc: "부드러운 여성, 따뜻함" },
  { id: "Leda", label: "레다", desc: "젊은 여성, 생기" },
  { id: "Orus", label: "오루스", desc: "안정적 남성, 신뢰감" },
];
export const RECAP_DEFAULT_VOICE = "Charon";
export const isRecapVoice = (v: string) => RECAP_VOICES.some((x) => x.id === v);

export type RecapImageSource = "cardnews" | "ai";
export type RecapStatus = "script" | "audio" | "images" | "ready" | "failed";

/** 장면 1개 — recap_shorts_jobs.scenes[] 원소. */
export interface RecapScene {
  idx: number;
  /** TTS로 읽을 내레이션(한국어 1~2문장). */
  narration: string;
  /** 화면 자막(≤2줄). */
  caption: string;
  /** AI 이미지 생성용 영어 프롬프트. */
  imagePrompt: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  durationMs?: number | null;
  error?: string | null;
}

/** 필요 키 설정 여부 — UI 안내용(값은 노출하지 않음). */
export function recapProviderStatus(): { script: boolean; tts: boolean } {
  return {
    script: !!process.env.ANTHROPIC_API_KEY,
    tts: !!process.env.GEMINI_API_KEY,
  };
}
