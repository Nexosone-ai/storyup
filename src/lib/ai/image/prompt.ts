/**
 * 이미지 프롬프트 공통 원칙:
 * - "no text": STORYUP이 위에 자체 타이포그래피를 얹는다.
 * - 사람 배제: "no people" 같은 부정 지시는 모델이 무시하거나 오히려 사람을
 *   유도한다(얼굴·손 왜곡 → 기괴한 결과). 대신 사람이 등장할 수 없는 구도
 *   (오버헤드 클로즈업 정물, 프레임을 채우는 사물)를 긍정 지시로 강제한다.
 * - 긴 문장(제목)은 피사체를 흐리므로 명사형 키워드를 우선 사용한다.
 */
const NO_TEXT =
  "Absolutely no text, no letters, no words, no numbers, no logos, no watermarks, no signage.";

const STILL_LIFE_FRAMING =
  "A few beautifully arranged items on a clean wooden table, photographed from directly above, " +
  "tight crop filling the frame, bright soft morning window light, warm inviting earthy tones, " +
  "minimalist premium composition, high-end magazine quality.";

/** Builds a photographic image prompt for a card backdrop. */
export function buildCardImagePrompt(category: string, subject: string): string {
  const scene = subject.trim().slice(0, 180);
  return [
    `Overhead close-up still-life photography of objects related to a ${category} business: ${scene}.`,
    STILL_LIFE_FRAMING,
    NO_TEXT,
  ].join(" ");
}

/** Wide still-life hero photograph for a blog post cover. */
export function buildBlogCoverPrompt(
  category: string,
  title: string,
  keywords: string[],
): string {
  const subject = (
    keywords.length ? keywords.slice(0, 4).join(", ") : title
  ).slice(0, 120);
  return [
    `Overhead close-up still-life photography of objects related to a ${category} business: ${subject}.`,
    STILL_LIFE_FRAMING,
    NO_TEXT,
  ].join(" ");
}
