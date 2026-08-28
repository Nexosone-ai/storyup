/**
 * 이미지 프롬프트 공통 원칙:
 * - "no text": STORYUP이 위에 자체 타이포그래피를 얹는다.
 * - 사람 배제: "no people" 같은 부정 지시는 모델이 무시하거나 오히려 사람을
 *   유도한다(얼굴·손 왜곡 → 기괴한 결과). 대신 사람이 등장할 수 없는 구도
 *   (오버헤드 클로즈업 정물, 프레임을 채우는 사물)를 긍정 지시로 강제한다.
 * - scene은 반드시 **영문** 피사체 묘사여야 한다. 한글은 이미지 모델이
 *   이해하지 못해 피사체 없는 빈 배경이 나온다 — AIProvider.generateImageSubject
 *   또는 블로그 생성 결과의 image_subject를 사용할 것.
 */
const NO_TEXT =
  "Absolutely no text, no letters, no words, no numbers, no logos, no watermarks, no signage.";

const STILL_LIFE_FRAMING =
  "Beautifully arranged, photographed from directly above, tight crop with the objects filling the frame, " +
  "bright soft morning window light, warm inviting earthy tones, " +
  "minimalist premium composition, high-end magazine quality.";

/** Builds a photographic image prompt for a card backdrop. scene은 영문 피사체 묘사. */
export function buildCardImagePrompt(category: string, scene: string): string {
  return [
    `Overhead close-up still-life photography for a ${category} business:`,
    `${scene.trim().slice(0, 220)}.`,
    STILL_LIFE_FRAMING,
    NO_TEXT,
  ].join(" ");
}

/** Wide still-life hero photograph for a blog post cover. scene은 영문 피사체 묘사. */
export function buildBlogCoverPrompt(category: string, scene: string): string {
  return [
    `Overhead close-up still-life photography for a ${category} business:`,
    `${scene.trim().slice(0, 220)}.`,
    STILL_LIFE_FRAMING,
    NO_TEXT,
  ].join(" ");
}
