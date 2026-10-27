import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** 파트너 패킷(크레딧) 부족 — 에이전트 작업 차단. 관리자 충전 안내용. */
export class InsufficientCreditsError extends Error {
  constructor(ko = true) {
    super(
      ko
        ? "파트너 패킷(크레딧)이 부족해요. 관리자에게 충전을 요청해주세요."
        : "Not enough partner credits. Please ask the admin to top up.",
    );
    this.name = "InsufficientCreditsError";
  }
}

/**
 * 과금 자체를 처리하지 못함(가격 조회 실패·차감 인프라 오류 등). 과금 불가 시
 * 무상 진행을 막기 위해(fail-closed) 작업을 차단한다. '부족'과는 구분.
 */
export class CreditChargeError extends Error {
  constructor(ko = true) {
    super(
      ko
        ? "크레딧 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요."
        : "Could not process credits. Please try again shortly.",
    );
    this.name = "CreditChargeError";
  }
}

export interface CreditCharge {
  charged: number;
  refund: () => Promise<void>;
}
const NOOP_CHARGE: CreditCharge = { charged: 0, refund: async () => {} };

/**
 * 대행 파트너 — partner 플랜 계정이 관리자에게 배정받은 고객 사업장을 운영한다.
 * 파트너 여부는 '본인' 구독으로 판정한다(account_owner 해석 안 함 — 파트너가 고객
 * 사업장을 운영할 때 고객 플랜으로 오판되면 안 되므로). 서버 전용.
 */

/** 사용자 본인의 플랜이 partner(활성·미만료)인지. */
export async function isPartner(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status !== "active" || data.plan !== "partner") return false;
  if (
    data.current_period_end &&
    new Date(data.current_period_end).getTime() < Date.now()
  )
    return false;
  return true;
}

/** 현재 세션 사용자가 파트너인지. */
export async function isCurrentUserPartner(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return isPartner(user.id);
}

/** 이 고객(오너 user_id)에게 배정된 대행 파트너가 있는지 — 오토파일럿 게이트용. */
export async function businessManagedByPartner(
  clientUserId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("partner_clients")
    .select("id", { count: "exact", head: true })
    .eq("client_user_id", clientUserId);
  return (count ?? 0) > 0;
}

export interface PartnerClientBiz {
  clientUserId: string;
  clientName: string | null;
  clientEmail: string | null;
  businesses: { id: string; name: string }[];
}

/** 파트너에게 배정된 고객 + 각 고객의 사업장 목록(관리자 클라이언트로 조회). */
export async function listPartnerClients(
  partnerUserId: string,
): Promise<PartnerClientBiz[]> {
  const admin = createAdminClient();
  const { data: links } = await admin
    .from("partner_clients")
    .select("client_user_id")
    .eq("partner_user_id", partnerUserId);
  const clientIds = [...new Set((links ?? []).map((l) => l.client_user_id))];
  if (!clientIds.length) return [];

  const [{ data: profiles }, { data: bizs }] = await Promise.all([
    admin.from("profiles").select("user_id, name, email").in("user_id", clientIds),
    admin.from("businesses").select("id, name, user_id").in("user_id", clientIds),
  ]);
  const pMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const bMap = new Map<string, { id: string; name: string }[]>();
  for (const b of bizs ?? []) {
    const arr = bMap.get(b.user_id) ?? [];
    arr.push({ id: b.id, name: b.name });
    bMap.set(b.user_id, arr);
  }
  return clientIds.map((cid) => ({
    clientUserId: cid,
    clientName: pMap.get(cid)?.name ?? null,
    clientEmail: pMap.get(cid)?.email ?? null,
    businesses: bMap.get(cid) ?? [],
  }));
}

export interface PartnerAssignmentRow {
  id: string;
  partnerEmail: string | null;
  clientEmail: string | null;
  createdAt: string;
}

/** 파트너 크레딧(패킷) 잔액. */
export async function getPartnerCreditBalance(
  partnerUserId: string,
): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_credit_ledger")
    .select("amount")
    .eq("partner_user_id", partnerUserId);
  return (data ?? []).reduce((s, r) => s + r.amount, 0);
}

/**
 * 작업별 크레딧 단가. 반환값:
 *  - 숫자(>=0): 설정된 단가(0 = 관리자가 명시적으로 무료 처리).
 *  - null: 단가를 '확인할 수 없음'(행 없음·조회 오류) → 호출부가 fail-closed로 차단.
 * active=false는 관리자가 과금을 끈 것으로 보고 0(무료)로 처리한다.
 */
export async function getCreditPrice(action: string): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_credit_prices")
    .select("credits, active")
    .eq("action", action)
    .maybeSingle();
  if (error) return null; // 조회 오류 → 알 수 없음(무상 통과 금지)
  if (!data) return null; // 단가 행 없음 → 알 수 없음(무상 통과 금지)
  if (!data.active) return 0; // 관리자가 과금 비활성 → 무료
  return Math.max(0, data.credits);
}

/**
 * 에이전트 작업 실행 시 파트너 크레딧 차감. 단가 0이면 무차감.
 * 잔액 부족 시 InsufficientCreditsError. 단가를 알 수 없거나 차감 인프라 오류면
 * CreditChargeError로 '차단'한다(fail-closed — 무상 진행 금지). 실패 시 refund().
 */
export async function chargePartnerCredits(
  partnerUserId: string,
  action: string,
  refBusinessId?: string,
  ko = true,
  units = 1,
): Promise<CreditCharge> {
  const base = await getCreditPrice(action);
  if (base === null) {
    // 단가를 확인할 수 없음 — 무상 진행 금지.
    console.error("[partner-credits] price unknown for action:", action);
    throw new CreditChargeError(ko);
  }
  // units = 수량(배수) — 영상 길이처럼 1회를 N배 단가로 차감할 때 사용.
  const credits = base * Math.max(1, Math.floor(units));
  if (credits <= 0) return NOOP_CHARGE; // 명시적 무료(예: AGENT_CHAT)
  const admin = createAdminClient();
  const { error } = await admin.rpc("spend_partner_credits", {
    p_partner: partnerUserId,
    p_amount: credits,
    p_reason: `agent:${action}`,
    p_ref_business: refBusinessId ?? null,
  });
  if (error) {
    if (/INSUFFICIENT_CREDITS/.test(error.message))
      throw new InsufficientCreditsError(ko);
    // 차감 인프라 오류 — 무상 진행 금지(fail-closed).
    console.error("[partner-credits]", error.message);
    throw new CreditChargeError(ko);
  }
  return {
    charged: credits,
    refund: async () => {
      await admin.from("partner_credit_ledger").insert({
        partner_user_id: partnerUserId,
        amount: credits,
        reason: `refund:${action}`,
        ref_type: "refund",
        ref_business_id: refBusinessId ?? null,
      });
    },
  };
}

export interface CreditPriceInfo {
  action: string;
  label: string;
  credits: number;
}
/** 작업별 크레딧 단가(활성) — 파트너에게 패킷 사용 안내로 표시. */
export async function listCreditPrices(): Promise<CreditPriceInfo[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_credit_prices")
    .select("action, label, credits")
    .eq("active", true)
    .order("credits", { ascending: true });
  return (data ?? []).map((r) => ({
    action: r.action,
    label: r.label,
    credits: r.credits,
  }));
}

/** 관리자 — 파트너에게 크레딧 지급(계약/충전). */
export async function grantPartnerCredits(
  partnerUserId: string,
  amount: number,
  reason: string,
  createdBy: string | null,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("partner_credit_ledger").insert({
    partner_user_id: partnerUserId,
    amount,
    reason,
    ref_type: "grant",
    created_by: createdBy,
  });
}

/** 이 고객(오너)을 대행하는 파트너의 user_id(첫 배정). 오토파일럿 과금 대상. */
export async function partnerForClient(
  clientUserId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_clients")
    .select("partner_user_id")
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.partner_user_id ?? null;
}

/** 관리자용 — 전체 파트너↔고객 배정 목록. */
export async function listPartnerAssignments(): Promise<PartnerAssignmentRow[]> {
  const admin = createAdminClient();
  const { data: links } = await admin
    .from("partner_clients")
    .select("id, partner_user_id, client_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = links ?? [];
  const ids = [
    ...new Set(rows.flatMap((r) => [r.partner_user_id, r.client_user_id])),
  ];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("user_id, email").in("user_id", ids)
    : { data: [] };
  const emailMap = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));
  return rows.map((r) => ({
    id: r.id,
    partnerEmail: emailMap.get(r.partner_user_id) ?? null,
    clientEmail: emailMap.get(r.client_user_id) ?? null,
    createdAt: r.created_at,
  }));
}
