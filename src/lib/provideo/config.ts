/**
 * 파트너 전문 영상 파이프라인(provideo) 설정·게이팅.
 * 각 단계는 독립 env 키로 활성화 — 키가 없으면 그 단계는 '준비중'으로 표시된다.
 * 스토리/프롬프트=Claude, 이미지=GPT, 영상=Seedance, 음악=SUNO.
 */

/** 기능 자체 노출(기본 비활성). 운영 준비 후 켠다. */
export const PROVIDEO_ENABLED = process.env.NEXT_PUBLIC_PROVIDEO_ENABLED === "true";

/** 스토리/프롬프트 — Claude(Opus 5.5). 모델은 env로 덮어쓸 수 있다. */
export const PROVIDEO_STORY_MODEL =
  process.env.PROVIDEO_STORY_MODEL || "claude-opus-5-5";

/** 각 단계 프로바이더 키 존재 여부(서버에서만 호출). */
export function providerStatus(): {
  story: boolean;
  image: boolean;
  video: boolean;
  music: boolean;
} {
  return {
    story: !!process.env.ANTHROPIC_API_KEY,
    image: !!process.env.OPENAI_API_KEY,
    video: !!process.env.SEEDANCE_API_KEY,
    // 음악은 키 + 엔드포인트(설정 가능) 둘 다 있어야 활성.
    music: !!process.env.SUNO_API_KEY && !!process.env.SUNO_API_BASE,
  };
}
