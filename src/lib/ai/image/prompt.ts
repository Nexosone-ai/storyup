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
import type { ImageStyleId } from "./style";

const NO_TEXT =
  "Absolutely no text, no letters, no words, no numbers, no logos, no watermarks, no signage.";

const STILL_LIFE_FRAMING =
  "Beautifully arranged, photographed from directly above, tight crop with the objects filling the frame, " +
  "bright soft morning window light, warm inviting earthy tones, " +
  "minimalist premium composition, high-end magazine quality.";

// 블로그 커버/본문 사진 — 정물 강제 대신 글 주제를 담은 장면을 자연스럽게 담는다.
// (주제가 추상적일 때 '책상 위 문구류' 같은 상투적 정물로 수렴하는 문제 방지.)
const BLOG_SCENE_FRAMING =
  "Captured as a natural editorial scene that conveys the topic, the relevant setting and objects arranged in context, " +
  "no people present, bright soft natural light, warm inviting tones, " +
  "clean premium composition, high-end magazine quality.";

/**
 * 스타일별 "표현 매체" 지시문. 피사체(scene)는 공통, 아래 문구만 바꿔 같은 소재를
 * 사진/일러스트/회화 등으로 렌더한다. 모든 스타일에서 NO_TEXT는 유지한다
 * (이미지 모델이 글자를 그리면 깨지므로, 다이어그램도 아이콘·도형 위주로 유도).
 */
const STYLE_FRAMING: Record<ImageStyleId, (category: string) => string> = {
  photo: (category) =>
    `Editorial photograph that visually conveys the topic for a ${category} business:`,
  illustration: (category) =>
    `Modern flat vector illustration for a ${category} business, clean bold shapes, harmonious palette, subtle gradients, editorial illustration style:`,
  painting: (category) =>
    `Expressive oil painting artwork for a ${category} business, visible brush strokes, rich textured color, fine-art composition:`,
  watercolor: (category) =>
    `Soft watercolor painting for a ${category} business, delicate washes, gentle gradients, hand-painted paper texture:`,
  diagram: (category) =>
    `Minimal flat infographic-style illustration for a ${category} business, simple icons and geometric shapes, clean schematic layout, limited flat palette:`,
  "3d": (category) =>
    `Polished 3D render for a ${category} business, soft studio lighting, smooth rounded shapes, matte clay material, shallow depth of field:`,
};

/** 사진 스타일에만 붙는 구도 지시 — 다른 매체는 구도를 과하게 고정하지 않는다. */
const STYLE_EXTRA: Partial<Record<ImageStyleId, string>> = {
  photo: BLOG_SCENE_FRAMING,
};

/**
 * 블로그 커버·본문 이미지 프롬프트를 스타일에 맞춰 만든다. scene은 영문 피사체 묘사.
 * style 미지정이면 기존과 동일한 실사(photo).
 */
export function buildBlogImagePrompt(
  category: string,
  scene: string,
  style: ImageStyleId = "photo",
): string {
  return [
    STYLE_FRAMING[style](category),
    `${scene.trim().slice(0, 220)}.`,
    STYLE_EXTRA[style] ?? "",
    NO_TEXT,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Builds a photographic image prompt for a card backdrop. scene은 영문 피사체 묘사. */
export function buildCardImagePrompt(category: string, scene: string): string {
  return [
    `Overhead close-up still-life photography for a ${category} business:`,
    `${scene.trim().slice(0, 220)}.`,
    STILL_LIFE_FRAMING,
    NO_TEXT,
  ].join(" ");
}

/**
 * 랜딩페이지 섹션용 사진 — 정물 강제 대신 업종의 실제 공간/현장을 담는다.
 * (헬스장 소개 카드에 책상 정물이 나오는 문제 방지.) scene은 영문 장면 묘사.
 */
export function buildSitePhotoPrompt(category: string, scene: string): string {
  return [
    `Professional editorial photography for a ${category} business website:`,
    `${scene.trim().slice(0, 220)}.`,
    "Quiet unoccupied space captured in natural composition, " +
      "bright soft natural light, warm inviting tones, " +
      "clean premium look, high-end magazine quality.",
    NO_TEXT,
  ].join(" ");
}
