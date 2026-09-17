/**
 * Supabase Storage 공개 이미지 URL을 이미지 변환(썸네일) URL로 바꾼다.
 *   .../storage/v1/object/public/...  →  .../storage/v1/render/image/public/...?width=&quality=
 *
 * 쇼케이스(포트폴리오) 그리드는 작은 카드에 원본(히어로 1920px·AI 이미지 최대 10MB)을
 * 그대로 받아 느렸다. 변환 엔드포인트로 카드 크기에 맞게 축소하면 전송량이 크게 준다.
 * 변환 엔드포인트는 브라우저 Accept 헤더에 따라 WebP/AVIF로 자동 협상된다.
 *
 * 매칭되지 않는 URL(외부·data:·이미 변환됨)은 그대로 반환한다.
 */
export function storageThumb(
  url: string | null | undefined,
  width: number,
  quality = 70,
): string {
  if (!url) return "";
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url; // Supabase 공개 오브젝트 URL이 아니면 변환하지 않음
  const rendered =
    url.slice(0, idx) +
    "/storage/v1/render/image/public/" +
    url.slice(idx + marker.length);
  const sep = rendered.includes("?") ? "&" : "?";
  return `${rendered}${sep}width=${width}&quality=${quality}`;
}
