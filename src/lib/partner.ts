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

/**
 * 추천코드(profiles.referral_code)로 활성 파트너를 찾는다 — 영업 링크(?ref=) 귀속용.
 * 파트너가 아니면 null(일반 사용자 추천은 리워드 시스템이 따로 처리).
 */
export async function resolvePartnerByReferralCode(
  code: string,
): Promise<string | null> {
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(cleaned)) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("referral_code", cleaned)
    .maybeSingle();
  if (!profile) return null;
  return (await isPartner(profile.user_id)) ? profile.user_id : null;
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

// ============================================================
//  서브파트너(2차 파트너) 계층 — partner_subs
//  서브파트너 = partner 플랜 계정이면서 partner_subs.sub_partner_user_id 로 등록된 계정.
//  상위파트너 = partner 플랜이면서 서브로 등록되지 않은 계정. 깊이는 2단계로 제한한다.
// ============================================================

/** 이 사용자가 누군가의 '활성' 서브파트너인지. */
export async function isSubPartner(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_subs")
    .select("id")
    .eq("sub_partner_user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}

/** 이 서브파트너의 상위파트너 user_id(활성). 없으면 null. */
export async function parentPartnerOf(
  subUserId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_subs")
    .select("parent_partner_user_id")
    .eq("sub_partner_user_id", subUserId)
    .eq("status", "active")
    .maybeSingle();
  return data?.parent_partner_user_id ?? null;
}

export interface SubPartnerRow {
  id: string;
  subUserId: string;
  name: string | null;
  email: string | null;
  status: string;
  clientCount: number;
  createdAt: string;
}

/** 상위파트너의 서브파트너 목록 + 각 서브의 가입 고객 수. */
export async function listSubPartners(
  parentUserId: string,
): Promise<SubPartnerRow[]> {
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("partner_subs")
    .select("id, sub_partner_user_id, status, created_at")
    .eq("parent_partner_user_id", parentUserId)
    .order("created_at", { ascending: false });
  const rows = subs ?? [];
  if (!rows.length) return [];

  const subIds = rows.map((r) => r.sub_partner_user_id);
  const [{ data: profiles }, { data: links }] = await Promise.all([
    admin.from("profiles").select("user_id, name, email").in("user_id", subIds),
    admin
      .from("partner_clients")
      .select("partner_user_id")
      .in("partner_user_id", subIds),
  ]);
  const pMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const countMap = new Map<string, number>();
  for (const l of links ?? [])
    countMap.set(
      l.partner_user_id,
      (countMap.get(l.partner_user_id) ?? 0) + 1,
    );

  return rows.map((r) => ({
    id: r.id,
    subUserId: r.sub_partner_user_id,
    name: pMap.get(r.sub_partner_user_id)?.name ?? null,
    email: pMap.get(r.sub_partner_user_id)?.email ?? null,
    status: r.status,
    clientCount: countMap.get(r.sub_partner_user_id) ?? 0,
    createdAt: r.created_at,
  }));
}

/** 상위파트너의 모든 서브파트너 user_id(활성) — 모니터링 롤업용. */
export async function subPartnerUserIds(
  parentUserId: string,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_subs")
    .select("sub_partner_user_id")
    .eq("parent_partner_user_id", parentUserId)
    .eq("status", "active");
  return [...new Set((data ?? []).map((r) => r.sub_partner_user_id))];
}

/**
 * 상위파트너가 이메일로 서브파트너를 초대(즉시 활성). 호출 전 caller가 상위파트너임을 확인.
 * 대상에게 partner 플랜을 부여(파트너 기능 재사용)하고 partner_subs 에 등록한다.
 * 깊이 2단계 제한 — 대상이 이미 서브이거나(상위 1명) 이미 서브를 둔 상위파트너면 거부.
 */
export async function inviteSubPartner(
  parentUserId: string,
  email: string,
): Promise<{ subUserId?: string; error?: string }> {
  const admin = createAdminClient();
  const target = email.trim().toLowerCase();
  if (!target) return { error: "이메일을 입력해주세요." };

  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", target)
    .maybeSingle();
  if (!profile)
    return {
      error: "해당 이메일의 가입 사용자를 찾을 수 없습니다. 먼저 회원가입을 안내해주세요.",
    };
  return registerSubPartnerById(parentUserId, profile.user_id, parentUserId);
}

/**
 * user_id 로 서브파트너(파트너(영업)) 등록 — 초대(이메일)·추천 링크 리크루트 공용.
 * 깊이 2단계 검증 + partner 플랜 부여 + partner_subs 등록. createdBy = 실제 리크루트한 사람.
 */
export async function registerSubPartnerById(
  parentUserId: string,
  subId: string,
  createdBy: string,
): Promise<{ subUserId?: string; error?: string }> {
  const admin = createAdminClient();
  if (subId === parentUserId)
    return { error: "본인을 서브파트너로 등록할 수 없습니다." };

  // 이미 (누군가의) 서브인지 — sub_partner_user_id 유니크.
  const { data: existingSub } = await admin
    .from("partner_subs")
    .select("parent_partner_user_id, status")
    .eq("sub_partner_user_id", subId)
    .maybeSingle();
  if (existingSub) {
    if (existingSub.parent_partner_user_id === parentUserId)
      return { error: "이미 등록된 서브파트너입니다." };
    return { error: "이미 다른 파트너의 서브파트너로 등록된 사용자입니다." };
  }

  // 대상이 이미 서브를 둔 상위파트너면 3단계가 되므로 거부(깊이 2단계 제한).
  const { count: ownSubs } = await admin
    .from("partner_subs")
    .select("id", { count: "exact", head: true })
    .eq("parent_partner_user_id", subId);
  if ((ownSubs ?? 0) > 0)
    return {
      error: "이미 서브파트너를 보유한 파트너는 서브파트너로 등록할 수 없습니다.",
    };

  // partner 플랜 부여(무기한 활성) — 파트너 기능 전체 재사용. 결제 없음.
  const { error: planErr } = await admin.from("subscriptions").upsert(
    {
      user_id: subId,
      plan: "partner",
      status: "active",
      current_period_end: null,
      billing_key: null,
      cancel_at_period_end: false,
      trial: false,
      billing_failures: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (planErr) {
    console.error("[sub-partner] plan grant failed", planErr);
    return { error: "서브파트너 권한 부여에 실패했습니다." };
  }

  const { error: linkErr } = await admin.from("partner_subs").insert({
    parent_partner_user_id: parentUserId,
    sub_partner_user_id: subId,
    status: "active",
    created_by: createdBy,
  });
  if (linkErr) {
    console.error("[sub-partner] link insert failed", linkErr);
    return { error: "서브파트너 등록에 실패했습니다." };
  }
  return { subUserId: subId };
}

/**
 * 영업파트너 모집 링크(/join?ref=코드&as=partner)로 가입한 사용자를 파트너(영업)으로 등록.
 * - 추천인이 상위파트너면 그 아래에, 추천인이 파트너(영업)이면 깊이 제한(2단계) 때문에
 *   추천인의 상위파트너 아래에 등록한다(created_by 에 실제 리크루터를 남긴다).
 * - 가입자가 이미 파트너/관리자면 등록하지 않는다. 성공 시 true.
 */
export async function recruitSubPartnerFromReferral(
  referrerUserId: string,
  newUserId: string,
): Promise<boolean> {
  try {
    if (referrerUserId === newUserId) return false;
    if (!(await isPartner(referrerUserId))) return false;
    if (await isPartner(newUserId)) return false;
    const admin = createAdminClient();
    const { data: prof } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("user_id", newUserId)
      .maybeSingle();
    if (prof?.is_admin) return false;
    const parentId = (await isSubPartner(referrerUserId))
      ? await parentPartnerOf(referrerUserId)
      : referrerUserId;
    if (!parentId) return false;
    const res = await registerSubPartnerById(parentId, newUserId, referrerUserId);
    if (res.error) {
      console.warn("[sub-partner] referral recruit skipped:", res.error);
      return false;
    }
    // 파트너가 된 계정은 고객 배정 대상이 아니다(혹시 남아 있는 링크 정리).
    await admin.from("partner_clients").delete().eq("client_user_id", newUserId);
    return true;
  } catch (err) {
    console.error("[sub-partner] referral recruit failed", err);
    return false;
  }
}

/** 서브파트너 상태 변경(활성/중단). 상위파트너 본인의 서브만. */
export async function setSubPartnerStatus(
  parentUserId: string,
  subUserId: string,
  status: "active" | "suspended",
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("partner_subs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("parent_partner_user_id", parentUserId)
    .eq("sub_partner_user_id", subUserId);
  if (error) return { error: "상태 변경에 실패했습니다." };
  return {};
}

/** 관리자용 — 전체 파트너↔고객 배정 목록. */
export interface PartnerListRow {
  userId: string;
  email: string | null;
  name: string | null;
  credits: number;
  clientCount: number;
  isSub: boolean;
  since: string;
}

/** 관리자: 현재 파트너(plan=partner·active) 전체 — 잔여 패킷·배정 고객 수 포함. */
export async function listPartners(): Promise<PartnerListRow[]> {
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("subscriptions")
    .select("user_id, updated_at, current_period_end")
    .eq("plan", "partner")
    .eq("status", "active")
    .limit(500);
  const now = Date.now();
  const rows = (subs ?? []).filter(
    (s) => !s.current_period_end || new Date(s.current_period_end).getTime() >= now,
  );
  const ids = rows.map((s) => s.user_id);
  if (ids.length === 0) return [];
  const [{ data: profiles }, { data: ledger }, { data: clients }, { data: subPartners }] =
    await Promise.all([
      admin.from("profiles").select("user_id, email, name").in("user_id", ids),
      admin.from("partner_credit_ledger").select("partner_user_id, amount").in("partner_user_id", ids),
      admin.from("partner_clients").select("partner_user_id").in("partner_user_id", ids),
      admin.from("partner_subs").select("sub_partner_user_id").in("sub_partner_user_id", ids),
    ]);
  const prof = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const credits = new Map<string, number>();
  for (const l of ledger ?? [])
    credits.set(l.partner_user_id, (credits.get(l.partner_user_id) ?? 0) + l.amount);
  const clientCount = new Map<string, number>();
  for (const c of clients ?? [])
    clientCount.set(c.partner_user_id, (clientCount.get(c.partner_user_id) ?? 0) + 1);
  const subSet = new Set((subPartners ?? []).map((s) => s.sub_partner_user_id));
  return rows
    .map((s) => ({
      userId: s.user_id,
      email: prof.get(s.user_id)?.email ?? null,
      name: prof.get(s.user_id)?.name ?? null,
      credits: credits.get(s.user_id) ?? 0,
      clientCount: clientCount.get(s.user_id) ?? 0,
      isSub: subSet.has(s.user_id),
      since: s.updated_at,
    }))
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}

/**
 * 관리자: 파트너 자격 해제(삭제).
 * - 본인 구독을 free 로 전환(파트너 영역 접근 차단)
 * - 고객 배정(partner_clients)·서브파트너 관계(partner_subs, 상위/하위 양쪽) 삭제
 * - 패킷 원장·구매 주문·정산 기록은 보존(재무 기록은 삭제하지 않음)
 */
export async function removePartner(
  partnerUserId: string,
): Promise<{ ok?: true; error?: string; removedClients: number; removedSubs: number }> {
  const admin = createAdminClient();
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: partnerUserId,
      plan: "free",
      status: "active",
      current_period_end: null,
      billing_key: null,
      cancel_at_period_end: false,
      trial: false,
      billing_failures: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: "플랜 전환에 실패했습니다.", removedClients: 0, removedSubs: 0 };
  const { data: c } = await admin
    .from("partner_clients")
    .delete()
    .eq("partner_user_id", partnerUserId)
    .select("id");
  const { data: s } = await admin
    .from("partner_subs")
    .delete()
    .or(`parent_partner_user_id.eq.${partnerUserId},sub_partner_user_id.eq.${partnerUserId}`)
    .select("id");
  return { ok: true, removedClients: c?.length ?? 0, removedSubs: s?.length ?? 0 };
}

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
