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

/**
 * 플랫폼(STORYUP) 중개 수수료율 — 파트너가 기본요금(관리자 등록가) 위에 더한 마진에 부과한다.
 * 모든 파트너 상품 거래에 적용(마진의 10%를 수수료로 떼고 나머지를 파트너에게 정산).
 */
export const PLATFORM_COMMISSION_RATE = 0.1;

export interface PartnerSettlement {
  /** 본사가 가져가는 기본요금 공제액(음수 방지). */
  baseDeductionKrw: number;
  /** 파트너 마진 = 고객결제 − 기본요금(음수 방지). */
  marginKrw: number;
  /** 플랫폼 수수료 = 마진 × 수수료율(반올림). */
  commissionKrw: number;
  /** 파트너 실제 정산액 = 마진 − 수수료. */
  netKrw: number;
}

/**
 * 파트너 정산 산식(단일 진입점).
 *  1) 고객 결제액(gross)에서 본사 기본요금(basePrice)을 먼저 공제한다.
 *  2) 남은 파트너 마진에서 플랫폼 수수료(기본 10%)를 뗀다.
 *  3) 나머지를 파트너에게 정산(netKrw)한다.
 * 판매가 < 기본요금이면 마진·수수료·정산액 모두 0(음수 방지).
 */
export function computePartnerSettlement(
  grossKrw: number,
  basePriceKrw: number,
  rate: number = PLATFORM_COMMISSION_RATE,
): PartnerSettlement {
  const gross = Math.max(0, Math.floor(grossKrw));
  const base = Math.max(0, Math.floor(basePriceKrw));
  const baseDeductionKrw = Math.min(base, gross);
  const marginKrw = Math.max(0, gross - baseDeductionKrw);
  const commissionKrw = Math.round(marginKrw * rate);
  const netKrw = Math.max(0, marginKrw - commissionKrw);
  return { baseDeductionKrw, marginKrw, commissionKrw, netKrw };
}
