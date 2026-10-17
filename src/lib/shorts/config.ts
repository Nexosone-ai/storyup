/**
 * 쇼츠 영상 기능 활성화 여부. 기본 비활성(준비중) — 메뉴/패널은 '준비중'으로 표시한다.
 * 다시 켜려면 환경변수 NEXT_PUBLIC_SHORTS_ENABLED=true.
 */
export const SHORTS_ENABLED = process.env.NEXT_PUBLIC_SHORTS_ENABLED === "true";
