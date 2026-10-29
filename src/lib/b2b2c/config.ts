/**
 * B2B2C(파트너 중개 판매) 기능 플래그 + 공용 상수.
 *
 * 기본 비활성 — 이 플래그가 꺼져 있으면 기존 B2C 직접판매 화면·결제가 100% 그대로다.
 * 파트너 상품/스토어프론트/오퍼/청구서, 공개 요금표 비공개 전환 등 신규 동작은 모두
 * 이 플래그 뒤에서만 노출된다. 운영 준비·검증 후 NEXT_PUBLIC_B2B2C_ENABLED=true 로 켠다.
 * (서버·클라이언트 공용으로 읽을 수 있게 NEXT_PUBLIC 사용)
 */
export const B2B2C_ENABLED = process.env.NEXT_PUBLIC_B2B2C_ENABLED === "true";

/**
 * 요금제 기준가 버전 — 파트너 상품/청구서에 '연결된 요금제 버전'으로 스냅샷한다.
 * plans.ts 의 priceKrw 가 바뀌면 이 날짜도 함께 올린다(과거 청구서 불변성과 무관,
 * 어떤 기준가 세대에 묶였는지 추적용). 메모리 기준 2026-10-06 가격 개정.
 */
export const PLAN_PRICE_VERSION = "2026-10-06";

/** 파트너가 '요금제 연동 상품'으로 판매할 수 있는 기준 요금제(Free 제외). null = 커스텀(요금제 미연동). */
export const SELLABLE_BASE_PLANS = ["basic", "pro"] as const;
export type SellableBasePlan = (typeof SELLABLE_BASE_PLANS)[number];

/** 부가세 표기 방식. */
export type VatMode = "included" | "excluded";
/** 청구 방식. */
export type BillingType = "one_time" | "recurring";

/** 오퍼/청구서 공개 토큰 길이(바이트) — 추측 불가 URL. */
export const SECURE_TOKEN_BYTES = 24;
