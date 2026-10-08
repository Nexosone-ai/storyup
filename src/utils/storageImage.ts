/**
 * 쇼케이스 그리드 등에서 쓰는 썸네일 URL 헬퍼.
 *
 * 과거엔 Supabase 이미지 변환 엔드포인트(/render/image/...?width=)로 축소했으나,
 * 이 변환은 Pro 플랜의 "Storage Image Transformations" 쿼터(원본 100개/주기)를
 * 소모해 쉽게 초과된다(서로 다른 쇼케이스 이미지가 많아질수록 선형 증가). 초과 시
 * 이미지가 제한될 수 있어, 변환을 쓰지 않고 **원본 공개 URL을 그대로 반환**한다.
 * 대신 저장 단계에서 이미지를 미리 리사이즈·압축해(storeGeneratedImage 등) 전송량을
 * 줄인다. (egress·storage는 여유가 크지만 변환 쿼터는 작기 때문.)
 *
 */
export function storageThumb(url: string | null | undefined): string {
  return url ?? "";
}
