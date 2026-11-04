/**
 * 채널 공유 광고 마켓플레이스 기능 플래그 + 상수.
 *
 * 기본 비활성 — 꺼져 있으면 /dashboard/ads 는 기존 동작(ADS_ENABLED의 CPC 뷰 또는
 * 준비중 플레이스홀더)을 유지한다. 채널 등록·의뢰·결제·정산은 모두 이 플래그 뒤에서만.
 * 운영 준비·검증 후 NEXT_PUBLIC_CHANNEL_ADS_ENABLED=true 로 켠다.
 */
export const CHANNEL_ADS_ENABLED =
  process.env.NEXT_PUBLIC_CHANNEL_ADS_ENABLED === "true";

/** 플랫폼 중개 수수료율 — 결제액에서 떼고 나머지를 채널 보유자에게 정산한다. */
export const CHANNEL_SHARE_FEE_RATE = 0.2;

/** 증빙 제출 후 광고주 미확인 시 자동확정까지의 일수. */
export const CHANNEL_SHARE_AUTO_CONFIRM_DAYS = 7;

/** 지원 채널 플랫폼 + 한글 라벨. */
export const SHARE_PLATFORMS = [
  "youtube",
  "facebook",
  "instagram",
  "tiktok",
  "kakao",
  "band",
  "other",
] as const;
export type SharePlatform = (typeof SHARE_PLATFORMS)[number];

export const SHARE_PLATFORM_LABELS: Record<SharePlatform, string> = {
  youtube: "유튜브",
  facebook: "페이스북",
  instagram: "인스타그램",
  tiktok: "틱톡",
  kakao: "카카오그룹",
  band: "밴드",
  other: "기타",
};
