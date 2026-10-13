/** 광고 노출 슬롯 — 서버/클라이언트 공용(의존성 없음). */
export const AD_SLOTS = [
  "postTop",
  "postBottom",
  "blogList",
  "landing",
] as const;
export type AdSlot = (typeof AD_SLOTS)[number];
