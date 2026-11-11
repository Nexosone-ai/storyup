/**
 * 파트너 작업권(entitlements) 카탈로그 — 서버·클라이언트 공용(DB 접근 없음).
 *
 * 패킷(크레딧) 폐지(2026-11-11) 이후 요약 쇼츠·유사영상·Lite 계정 생성은 "작업권"을 쓴다.
 * 작업권은 고객이 파트너 상품(본사 상품 + 마진)을 결제하면 상품에 포함된 만큼 판매 파트너에게
 * 자동 지급되고(fulfillInvoicePaid), 관리자가 직접 부여할 수도 있다. 잔액 = partner_entitlements 합.
 * 키는 entitlement_services.key 와 같다(0112 시드).
 */
export const ENTITLEMENT_KEYS = [
  "RECAP_SHORTS",
  "EXTRA_IMAGE",
  "SIMILAR_VIDEO",
  "LITE_ACCOUNT_30D",
] as const;
export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export interface EntitlementServiceInfo {
  key: EntitlementKey;
  /** 파트너 화면 라벨. */
  label: string;
  /** 짧은 라벨(잔액 요약용). */
  shortLabel: string;
  /** 단위(편·장·회·개). */
  unitLabel: string;
  /** 고객 화면 라벨(청구서 '결제 후 제공'). '작업권' 단어는 쓰지 않는다. */
  customerLabel: string;
}

export const ENTITLEMENT_SERVICES: EntitlementServiceInfo[] = [
  {
    key: "RECAP_SHORTS",
    label: "요약 쇼츠",
    shortLabel: "쇼츠",
    unitLabel: "편",
    customerLabel: "블로그 요약 쇼츠",
  },
  {
    key: "EXTRA_IMAGE",
    label: "AI 이미지",
    shortLabel: "이미지",
    unitLabel: "장",
    customerLabel: "고화질 AI 이미지",
  },
  {
    key: "SIMILAR_VIDEO",
    label: "유사영상 10편(480p·5초 기준)",
    shortLabel: "유사영상",
    unitLabel: "회",
    customerLabel: "AI 유사영상 10편 세트",
  },
  {
    key: "LITE_ACCOUNT_30D",
    label: "Lite 계정 30일",
    shortLabel: "Lite",
    unitLabel: "개",
    customerLabel: "STORYUP Lite 계정 30일",
  },
];

const BY_KEY = new Map(ENTITLEMENT_SERVICES.map((s) => [s.key, s]));

export function isEntitlementKey(v: unknown): v is EntitlementKey {
  return typeof v === "string" && BY_KEY.has(v as EntitlementKey);
}

export function entitlementService(key: EntitlementKey): EntitlementServiceInfo {
  return BY_KEY.get(key)!;
}

/** 서비스별 잔액(모든 키 0 채움). */
export type EntitlementBalances = Record<EntitlementKey, number>;

export function emptyBalances(): EntitlementBalances {
  return { RECAP_SHORTS: 0, EXTRA_IMAGE: 0, SIMILAR_VIDEO: 0, LITE_ACCOUNT_30D: 0 };
}

/** 상품에 포함된 작업권 항목(상품·오퍼·청구서 스냅샷 jsonb 형태). */
export interface EntitlementItem {
  serviceKey: EntitlementKey;
  units: number;
}

/** 알 수 없는 jsonb → 유효한 항목만(키 중복 제거, units ≥ 1). */
export function parseEntitlementItems(raw: unknown): EntitlementItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: EntitlementItem[] = [];
  for (const x of raw) {
    const key = (x as { serviceKey?: unknown })?.serviceKey;
    const units = Math.floor(Number((x as { units?: unknown })?.units));
    if (!isEntitlementKey(key) || !Number.isFinite(units) || units < 1) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ serviceKey: key, units });
  }
  return out;
}

export type GrantablePlan = "basic" | "pro" | "lite";
const PLAN_LABEL: Record<GrantablePlan, string> = {
  basic: "STORYUP Basic",
  pro: "STORYUP Pro",
  lite: "STORYUP Lite",
};

/**
 * "결제 시 제공" 불릿 — 파트너 화면(partner)·고객 화면(customer) 공통 포매터.
 * partner → "요약 쇼츠 3편" / customer → "블로그 요약 쇼츠 3편", "STORYUP Basic 30일 이용".
 */
export function describeFulfillment(
  items: EntitlementItem[],
  planGrant: { plan: GrantablePlan | null; days: number } | null,
  audience: "partner" | "customer",
): string[] {
  const out: string[] = [];
  if (planGrant?.plan) {
    out.push(
      audience === "customer"
        ? `${PLAN_LABEL[planGrant.plan]} ${planGrant.days}일 이용`
        : `고객 플랜 ${PLAN_LABEL[planGrant.plan]} ${planGrant.days}일`,
    );
  }
  for (const it of items) {
    const s = entitlementService(it.serviceKey);
    out.push(
      audience === "customer"
        ? `${s.customerLabel} ${it.units}${s.unitLabel}`
        : `${s.label} ${it.units}${s.unitLabel}`,
    );
  }
  return out;
}

/** 잔액 한 줄 요약 — "쇼츠 3 · 유사영상 2 · Lite 1 · 이미지 10" / "작업권 없음". */
export function formatEntitlementSummary(b: Partial<EntitlementBalances> | null | undefined): string {
  const parts = ENTITLEMENT_SERVICES.filter((s) => (b?.[s.key] ?? 0) > 0).map(
    (s) => `${s.shortLabel} ${b?.[s.key] ?? 0}`,
  );
  return parts.length ? parts.join(" · ") : "작업권 없음";
}

/** 작업권 부족 안내 문구(파트너용, ko/en). */
export function noEntitlementMessage(key: EntitlementKey, ko = true): string {
  const s = entitlementService(key);
  return ko
    ? `보유한 ${s.label} 작업권이 없어요. 고객에게 상품을 판매(결제)한 뒤 사용할 수 있어요.`
    : `No ${s.label} work units left. Sell (and get paid for) a product to your client first.`;
}
