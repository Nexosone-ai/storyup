/**
 * 쇼츠 영상 기능 활성화 여부. 기본 '켜짐' — 끄려면 환경변수 NEXT_PUBLIC_SHORTS_ENABLED=false.
 * (유튜브 업로드는 별도로 GOOGLE_CLIENT_ID/SECRET 설정 시에만 노출된다.)
 */
export const SHORTS_ENABLED = process.env.NEXT_PUBLIC_SHORTS_ENABLED !== "false";
