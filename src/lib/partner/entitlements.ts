import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import {
  ENTITLEMENT_KEYS,
  emptyBalances,
  entitlementService,
  noEntitlementMessage,
  type EntitlementBalances,
  type EntitlementKey,
} from "./entitlementCatalog";

/**
 * 파트너 작업권(entitlements) — 패킷(크레딧)을 대체하는 파트너 도구 이용권. 서버 전용.
 * 원장 partner_entitlements(추가 전용) 합 = 잔액. 소비는 RPC consume_partner_entitlement(동시성 잠금).
 * 지급 경로: 고객 결제(fulfillInvoicePaid, invoice_grant) · 관리자 직접 부여(admin_grant) · 0112 환산(migration).
 */

/** 작업권 부족 — 호출부는 그대로 사용자에게 보여준다(판매 안내 포함). */
export class InsufficientEntitlementError extends Error {
  readonly serviceKey: EntitlementKey;
  readonly needed: number;
  readonly balance: number;
  constructor(serviceKey: EntitlementKey, needed: number, balance: number, ko = true) {
    super(noEntitlementMessage(serviceKey, ko));
    this.name = "InsufficientEntitlementError";
    this.serviceKey = serviceKey;
    this.needed = needed;
    this.balance = balance;
  }
}

/** 소비 처리 자체 실패(인프라 오류). fail-closed — 무상 진행 금지. */
export class EntitlementError extends Error {
  constructor(ko = true) {
    super(
      ko
        ? "작업권 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요."
        : "Could not process work units. Please try again shortly.",
    );
    this.name = "EntitlementError";
  }
}

/** 소비 결과 — 기존 CreditCharge{charged, refund} 와 같은 모양(호출부 최소 변경). */
export interface EntitlementCharge {
  serviceKey: EntitlementKey;
  consumed: number;
  refund: () => Promise<void>;
}

export interface EntitlementRef {
  refBusinessId?: string | null;
  refId?: string | null;
  reason?: string;
  ko?: boolean;
}

/** 파트너 1명의 서비스별 잔액(모든 키 0 채움). */
export async function getEntitlementBalances(
  partnerUserId: string,
): Promise<EntitlementBalances> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_entitlements")
    .select("service_key, delta")
    .eq("partner_user_id", partnerUserId);
  const out = emptyBalances();
  for (const r of data ?? []) {
    const k = r.service_key as EntitlementKey;
    if (k in out) out[k] += r.delta;
  }
  return out;
}

/** 여러 파트너의 잔액 요약(관리자 목록용). */
export async function entitlementSummaryFor(
  userIds: string[],
): Promise<Map<string, EntitlementBalances>> {
  const map = new Map<string, EntitlementBalances>();
  if (userIds.length === 0) return map;
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_entitlements")
    .select("partner_user_id, service_key, delta")
    .in("partner_user_id", userIds);
  for (const r of data ?? []) {
    const cur = map.get(r.partner_user_id) ?? emptyBalances();
    const k = r.service_key as EntitlementKey;
    if (k in cur) cur[k] += r.delta;
    map.set(r.partner_user_id, cur);
  }
  return map;
}

/**
 * 작업권 소비(선차감). 부족하면 InsufficientEntitlementError, 인프라 오류면 EntitlementError.
 * units 는 배수(유사영상 길이×화질). 반환 refund() 는 +units 환불 행을 추가한다(원장 삭제 없음).
 */
export async function consumeEntitlement(
  partnerUserId: string,
  serviceKey: EntitlementKey,
  units = 1,
  ref: EntitlementRef = {},
): Promise<EntitlementCharge> {
  const ko = ref.ko ?? true;
  const n = Math.max(1, Math.floor(units));
  const admin = createAdminClient();
  const { error } = await admin.rpc("consume_partner_entitlement", {
    p_partner: partnerUserId,
    p_service: serviceKey,
    p_units: n,
    p_reason: ref.reason ?? `consume:${serviceKey}`,
    p_ref_business: ref.refBusinessId ?? null,
    p_ref_id: ref.refId ?? null,
  });
  if (error) {
    if (/INSUFFICIENT_ENTITLEMENT/.test(error.message)) {
      const bal = await getEntitlementBalances(partnerUserId);
      throw new InsufficientEntitlementError(serviceKey, n, bal[serviceKey], ko);
    }
    console.error("[entitlements] consume failed", serviceKey, error.message);
    throw new EntitlementError(ko);
  }
  return {
    serviceKey,
    consumed: n,
    refund: async () => {
      await refundEntitlement(partnerUserId, serviceKey, n, {
        ...ref,
        reason: `refund:${ref.reason ?? serviceKey}`,
      });
    },
  };
}

/** 환불(+units). 작업 전부 실패·삭제 등. 실패해도 던지지 않고 로그만. */
export async function refundEntitlement(
  partnerUserId: string,
  serviceKey: EntitlementKey,
  units: number,
  ref: EntitlementRef = {},
): Promise<boolean> {
  const n = Math.floor(units);
  if (n <= 0) return false;
  const admin = createAdminClient();
  const { error } = await admin.from("partner_entitlements").insert({
    partner_user_id: partnerUserId,
    service_key: serviceKey,
    delta: n,
    reason: ref.reason ?? `refund:${serviceKey}`,
    ref_type: "refund",
    ref_business_id: ref.refBusinessId ?? null,
    ref_id: ref.refId ?? null,
  });
  if (error) console.error("[entitlements] refund failed", serviceKey, error.message);
  return !error;
}

/**
 * 관리자 직접 부여/보정. delta 는 0 이 아닌 정수(음수 = 차감 보정). 잔액이 0 미만이 되는 차감은 거부.
 * 호출 전 isCurrentUserAdmin() 확인.
 */
export async function grantEntitlement(
  partnerUserId: string,
  serviceKey: EntitlementKey,
  delta: number,
  reason: string,
  createdBy: string | null,
): Promise<{ error?: string; balance?: number }> {
  const d = Math.trunc(delta);
  if (!Number.isFinite(d) || d === 0) return { error: "수량(0 아님)을 입력해주세요." };
  const admin = createAdminClient();
  if (d < 0) {
    const bal = await getEntitlementBalances(partnerUserId);
    if (bal[serviceKey] + d < 0)
      return { error: `차감할 수 없어요. 현재 ${entitlementService(serviceKey).label} 작업권 ${bal[serviceKey]}${entitlementService(serviceKey).unitLabel}.` };
  }
  const { error } = await admin.from("partner_entitlements").insert({
    partner_user_id: partnerUserId,
    service_key: serviceKey,
    delta: d,
    reason: reason.trim() || "관리자 지급",
    ref_type: "admin_grant",
    created_by: createdBy,
  });
  if (error) {
    console.error("[entitlements] grant failed", error.message);
    return { error: "작업권 부여에 실패했어요." };
  }
  const bal = await getEntitlementBalances(partnerUserId);
  return { balance: bal[serviceKey] };
}

export interface EntitlementHistoryRow {
  id: string;
  serviceKey: EntitlementKey;
  delta: number;
  reason: string | null;
  refType: string;
  createdAt: string;
}

/** 파트너 본인 작업권 이력(최근순). */
export async function listEntitlementHistory(
  partnerUserId: string,
  limit = 50,
): Promise<EntitlementHistoryRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_entitlements")
    .select("id, service_key, delta, reason, ref_type, created_at")
    .eq("partner_user_id", partnerUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .filter((r) => (ENTITLEMENT_KEYS as readonly string[]).includes(r.service_key))
    .map((r) => ({
      id: r.id,
      serviceKey: r.service_key as EntitlementKey,
      delta: r.delta,
      reason: r.reason,
      refType: r.ref_type,
      createdAt: r.created_at,
    }));
}
