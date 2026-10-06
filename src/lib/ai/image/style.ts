/**
 * 블로그/사이트 이미지 스타일 — 피사체(영문 scene)는 그대로 두고 "표현 매체"만 바꾼다.
 * 라벨은 에디터(클라이언트)에서도 쓰므로 서버 전용 의존성 없이 데이터만 둔다.
 * 실제 프롬프트 문구는 image/prompt.ts의 buildBlogImagePrompt가 스타일별로 만든다.
 */
export const IMAGE_STYLES = [
  "photo",
  "illustration",
  "painting",
  "watercolor",
  "diagram",
  "3d",
] as const;

export type ImageStyleId = (typeof IMAGE_STYLES)[number];

export const IMAGE_STYLE_META: Record<
  ImageStyleId,
  { ko: string; en: string }
> = {
  photo: { ko: "실사 사진", en: "Photo" },
  illustration: { ko: "일러스트", en: "Illustration" },
  painting: { ko: "회화풍", en: "Painting" },
  watercolor: { ko: "수채화", en: "Watercolor" },
  diagram: { ko: "다이어그램", en: "Diagram" },
  "3d": { ko: "3D 렌더", en: "3D render" },
};

export function isImageStyle(v: unknown): v is ImageStyleId {
  return (
    typeof v === "string" && (IMAGE_STYLES as readonly string[]).includes(v)
  );
}

/** 임의 입력을 안전한 스타일 ID로 — 모르면 기본 실사(photo). */
export function coerceImageStyle(v: unknown): ImageStyleId {
  return isImageStyle(v) ? v : "photo";
}
