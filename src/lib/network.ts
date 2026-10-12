import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPlanById, type PlanId } from "@/lib/plans";
import {
  computeNetworkShares,
  ROLE_ORDER,
  ROLE_LABEL,
  clampPct,
  type NetworkRole,
  type Split,
} from "@/lib/networkShares";
import type {
  NetworkMemberRow,
  MarketerCommissionRow,
  MarketerSettlementRow,
} from "@/types/database";

export { computeNetworkShares, ROLE_LABEL };
export type { NetworkRole, Split };

/**
 * 3단계 유통 네트워크 — 총판(distributor) → 영업점(agency) → 리셀러(reseller).
 * - 관리자가 총판 등록 + (총판 × 플랜/상품별) 지급률(%) 설정, 총판 자격 부여/강등(정지).
 * - 총판이 배분비율(총판:영업점:리셀러) 설정, 총판→영업점→리셀러 하위 등록.
 * - 귀속: 구독=referrals(추천코드), 상품=product_orders.ref_marketer_id. 추천인이 활성 멤버여야 적립.
 * - 수당 풀 = 판매액 × 루트총판 지급률. 배분비율로 역할별 분배하되, 판매자가 하위 단계 몫을 흡수.
 * - 원장/정산은 marketer_commissions / marketer_settlements 재사용(멤버별 user_id 원장).
 * - 모든 쓰기는 service role. 조회 게이팅만 세션 클라이언트.
 */

// 추천코드 생성/조회 — referral.ts와 동일 규격이나 순환 import를 피하려 복제.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
async function ensureReferralCode(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("referral_code")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return null;
    if (profile?.referral_code) return profile.referral_code;
    for (let attempt = 0; attempt < 5; attempt++) {
      let code = "";
      for (let i = 0; i < 6; i++)
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      const { error: upErr } = await admin
        .from("profiles")
        .update({ referral_code: code })
        .eq("user_id", userId)
        .is("referral_code", null);
      if (!upErr) return code;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------- 멤버 조회 ----------------

export async function getNetworkMember(
  userId: string,
): Promise<NetworkMemberRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("network_members")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/** 현재 로그인 사용자가 활성 네트워크 멤버인지 (대시보드/메뉴 게이팅). */
export async function isCurrentUserNetworkMember(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("network_members")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    return data?.status === "active";
  } catch {
    return false;
  }
}

/** 추천코드로 활성 네트워크 멤버(판매자)를 찾는다. */
export async function resolveSellerByCode(
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
  const m = await getNetworkMember(profile.user_id);
  return m?.status === "active" ? profile.user_id : null;
}

/** 판매자에서 루트 총판까지 올라가며 역할별 멤버 user_id를 매핑. */
async function getChain(
  seller: NetworkMemberRow,
): Promise<Record<NetworkRole, string | undefined>> {
  const chain: Record<NetworkRole, string | undefined> = {
    distributor: undefined,
    agency: undefined,
    reseller: undefined,
  };
  let cur: NetworkMemberRow | null = seller;
  let guard = 0;
  while (cur && guard++ < 10) {
    chain[cur.role as NetworkRole] = cur.user_id;
    if (!cur.parent_id) break;
    cur = await getNetworkMember(cur.parent_id);
  }
  return chain;
}

// ---------------- 수당 적립 ----------------

async function accrueNetworkCommission(args: {
  source: "subscription" | "product";
  paymentId?: string;
  productOrderId?: string;
  clientUserId?: string | null;
  itemType: "subscription_plan" | "product";
  itemKey: string;
  itemLabel: string;
  gross: number;
  sellerUserId: string;
  occurredAt?: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const seller = await getNetworkMember(args.sellerUserId);
    if (!seller || seller.status !== "active") return;
    const root = await getNetworkMember(seller.distributor_id);
    if (!root || root.status !== "active") return;

    const { data: rateRow } = await admin
      .from("distributor_rates")
      .select("rate_pct,active")
      .eq("distributor_user_id", root.user_id)
      .eq("item_type", args.itemType)
      .eq("item_key", args.itemKey)
      .maybeSingle();
    const rate = rateRow?.active ? rateRow.rate_pct : 0;
    if (rate <= 0) return;

    const pool = Math.round((args.gross * rate) / 100);
    if (pool <= 0) return;

    const split: Split = {
      distributor: root.split_distributor,
      agency: root.split_agency,
      reseller: root.split_reseller,
    };
    const shares = computeNetworkShares({
      pool,
      split,
      sellerRole: seller.role as NetworkRole,
    });
    const chain = await getChain(seller);
    const occurredAt = args.occurredAt ?? new Date().toISOString();

    for (const role of ROLE_ORDER) {
      const amount = shares[role];
      if (amount <= 0) continue;
      const beneficiary = chain[role];
      if (!beneficiary) continue;
      const { error } = await admin.from("marketer_commissions").insert({
        marketer_id: beneficiary,
        source_type: args.source,
        payment_id: args.paymentId ?? null,
        product_order_id: args.productOrderId ?? null,
        client_user_id: args.clientUserId ?? null,
        item_key: args.itemKey,
        item_label: args.itemLabel,
        role_at_sale: role,
        seller_user_id: args.sellerUserId,
        pool_amount: pool,
        rate_pct: rate,
        gross_sale: args.gross,
        amount,
        status: "pending",
        occurred_at: occurredAt,
      });
      if (error && error.code !== "23505")
        console.error(
          "[network] commission insert failed",
          args.paymentId ?? args.productOrderId,
          role,
          error,
        );
    }
  } catch (err) {
    console.error("[network] accrueNetworkCommission error", err);
  }
}

/**
 * 구독 결제 1건 수당 적립 (멱등: payment_id × 수혜자). 매 결제마다 반복.
 * billing.ts가 chargeOnce PAID 직후 호출한다.
 */
export async function accrueSubscriptionCommission(args: {
  paymentId: string;
  clientUserId: string;
  planId: PlanId;
  amount: number;
  occurredAt?: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: ref } = await admin
      .from("referrals")
      .select("referrer_user_id")
      .eq("referred_user_id", args.clientUserId)
      .maybeSingle();
    if (!ref) return;
    await accrueNetworkCommission({
      source: "subscription",
      paymentId: args.paymentId,
      clientUserId: args.clientUserId,
      itemType: "subscription_plan",
      itemKey: args.planId,
      itemLabel: `${getPlanById(args.planId).name.ko} 구독`,
      gross: args.amount,
      sellerUserId: ref.referrer_user_id,
      occurredAt: args.occurredAt,
    });
  } catch (err) {
    console.error("[network] accrueSubscriptionCommission error", err);
  }
}

/**
 * 상품 주문 1건 수당 적립 (멱등: product_order_id × 수혜자).
 * orders.ts가 PAID 확정 뒤 호출한다.
 */
export async function accrueProductCommission(orderId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("product_orders")
      .select("id,status,ref_marketer_id,product_id,product_name,amount")
      .eq("order_id", orderId)
      .maybeSingle();
    if (
      !order ||
      order.status !== "PAID" ||
      !order.ref_marketer_id ||
      !order.product_id
    )
      return;
    await accrueNetworkCommission({
      source: "product",
      productOrderId: order.id,
      itemType: "product",
      itemKey: order.product_id,
      itemLabel: order.product_name,
      gross: order.amount,
      sellerUserId: order.ref_marketer_id,
    });
  } catch (err) {
    console.error("[network] accrueProductCommission error", err);
  }
}

// ---------------- 멤버 CRUD (액션에서 호출) ----------------

type ActionResult = { ok?: boolean; error?: string };

/** 관리자: 유저를 총판으로 등록(또는 재활성화). */
export async function registerDistributor(
  email: string,
  payoutType: "freelancer" | "business",
  createdBy: string | null,
): Promise<ActionResult> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", email.trim())
    .maybeSingle();
  if (!profile) return { error: "해당 이메일의 사용자를 찾을 수 없습니다." };

  const existing = await getNetworkMember(profile.user_id);
  if (existing) {
    if (existing.role !== "distributor")
      return { error: "이미 영업점/리셀러로 등록된 사용자입니다." };
    const { error } = await admin
      .from("network_members")
      .update({
        status: "active",
        payout_type: payoutType,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", profile.user_id);
    return error ? { error: "총판 재활성화에 실패했습니다." } : { ok: true };
  }

  await ensureReferralCode(profile.user_id);
  const { error } = await admin.from("network_members").insert({
    user_id: profile.user_id,
    role: "distributor",
    parent_id: null,
    distributor_id: profile.user_id,
    status: "active",
    payout_type: payoutType,
    split_distributor: 100,
    split_agency: 0,
    split_reseller: 0,
    created_by: createdBy,
  });
  if (error)
    return {
      error: "총판 등록에 실패했습니다. (0053 마이그레이션 적용 확인)",
    };
  return { ok: true };
}

/** 멤버 활성/정지 (총판 강등 = 정지 → 서브트리 신규 적립 중단). */
export async function setMemberStatus(
  userId: string,
  status: "active" | "suspended",
): Promise<ActionResult> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("network_members")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return error ? { error: "상태 변경에 실패했습니다." } : { ok: true };
}

/** 총판 배분비율 설정 (합계 100). */
export async function setDistributorSplit(
  distributorUserId: string,
  sd: number,
  sa: number,
  sr: number,
): Promise<ActionResult> {
  const a = clampPct(sd);
  const b = clampPct(sa);
  const c = clampPct(sr);
  if (a + b + c !== 100)
    return { error: "배분비율의 합이 100%가 되어야 합니다." };
  const admin = createAdminClient();
  const member = await getNetworkMember(distributorUserId);
  if (!member || member.role !== "distributor")
    return { error: "총판이 아닙니다." };
  const { error } = await admin
    .from("network_members")
    .update({
      split_distributor: a,
      split_agency: b,
      split_reseller: c,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", distributorUserId);
  return error ? { error: "배분비율 저장에 실패했습니다." } : { ok: true };
}

/** 총판별 지급률(%) 설정. */
export async function setDistributorRate(args: {
  distributorUserId: string;
  itemType: "subscription_plan" | "product";
  itemKey: string;
  ratePct: number;
  active: boolean;
}): Promise<ActionResult> {
  const pct = clampPct(args.ratePct);
  const admin = createAdminClient();
  const { error } = await admin.from("distributor_rates").upsert(
    {
      distributor_user_id: args.distributorUserId,
      item_type: args.itemType,
      item_key: args.itemKey,
      rate_pct: pct,
      active: args.active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "distributor_user_id,item_type,item_key" },
  );
  return error ? { error: "지급률 저장에 실패했습니다." } : { ok: true };
}

/** 하위 멤버 등록 — 총판→영업점, 영업점→리셀러. */
export async function addDownstreamMember(
  callerUserId: string,
  email: string,
): Promise<ActionResult> {
  const caller = await getNetworkMember(callerUserId);
  if (!caller || caller.status !== "active")
    return { error: "네트워크 멤버만 하위를 등록할 수 있습니다." };
  if (caller.role === "reseller")
    return { error: "리셀러는 하위를 등록할 수 없습니다." };
  const childRole: NetworkRole =
    caller.role === "distributor" ? "agency" : "reseller";

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", email.trim())
    .maybeSingle();
  if (!profile) return { error: "해당 이메일의 사용자를 찾을 수 없습니다." };
  if (profile.user_id === callerUserId)
    return { error: "본인은 등록할 수 없습니다." };
  const existing = await getNetworkMember(profile.user_id);
  if (existing) return { error: "이미 네트워크에 등록된 사용자입니다." };

  await ensureReferralCode(profile.user_id);
  const { error } = await admin.from("network_members").insert({
    user_id: profile.user_id,
    role: childRole,
    parent_id: callerUserId,
    distributor_id: caller.distributor_id,
    status: "active",
    payout_type: "freelancer",
    created_by: callerUserId,
  });
  if (error) return { error: "하위 멤버 등록에 실패했습니다." };
  return { ok: true };
}

// ---------------- 대시보드 (멤버) ----------------

export interface NetworkPerson {
  userId: string;
  name: string;
  email: string;
  role: NetworkRole;
  status: string;
  /** 직속 하위 수 */
  childCount: number;
}

export interface NetworkClient {
  userId: string;
  name: string;
  email: string;
  plan: string;
  paying: boolean;
}

export interface NetworkRateView {
  itemType: "subscription_plan" | "product";
  itemKey: string;
  ratePct: number;
  active: boolean;
}

export interface NetworkDashboard {
  member: {
    role: NetworkRole;
    status: string;
    split: Split;
    distributorId: string;
  };
  upline: { name: string; email: string; role: NetworkRole } | null;
  code: string | null;
  rates: NetworkRateView[]; // 루트 총판 기준 지급률(참고)
  downline: NetworkPerson[];
  clients: NetworkClient[];
  monthCommission: number;
  monthRevenue: number;
  totalCommission: number;
  paidCommission: number;
  recent: MarketerCommissionRow[];
  settlements: MarketerSettlementRow[];
}

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function profileMap(ids: string[]) {
  if (ids.length === 0) return new Map<string, { name: string; email: string }>();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("user_id,name,email")
    .in("user_id", ids);
  return new Map(
    (data ?? []).map((p) => [
      p.user_id,
      { name: p.name ?? "이름 없음", email: p.email ?? "" },
    ]),
  );
}

/** referrals(추천) 기준 직속 고객 목록 + 정기결제 여부. */
async function clientsOf(userId: string): Promise<NetworkClient[]> {
  const admin = createAdminClient();
  const { data: refs } = await admin
    .from("referrals")
    .select("referred_user_id")
    .eq("referrer_user_id", userId);
  const ids = (refs ?? []).map((r) => r.referred_user_id);
  if (ids.length === 0) return [];
  const [pm, { data: subs }] = await Promise.all([
    profileMap(ids),
    admin
      .from("subscriptions")
      .select("user_id,plan,status,trial,billing_key")
      .in("user_id", ids),
  ]);
  const subByUser = new Map((subs ?? []).map((s) => [s.user_id, s]));
  return ids.map((id) => {
    const s = subByUser.get(id);
    const paying = !!s && s.status === "active" && !s.trial && !!s.billing_key;
    return {
      userId: id,
      name: pm.get(id)?.name ?? "이름 없음",
      email: pm.get(id)?.email ?? "",
      plan: s?.plan ?? "free",
      paying,
    };
  });
}

export async function getNetworkDashboard(
  userId: string,
): Promise<NetworkDashboard | null> {
  const admin = createAdminClient();
  const member = await getNetworkMember(userId);
  if (!member) return null;
  const root = await getNetworkMember(member.distributor_id);
  const code = await ensureReferralCode(userId);

  // 업라인
  let upline: NetworkDashboard["upline"] = null;
  if (member.parent_id) {
    const parent = await getNetworkMember(member.parent_id);
    if (parent) {
      const pm = await profileMap([parent.user_id]);
      upline = {
        name: pm.get(parent.user_id)?.name ?? "이름 없음",
        email: pm.get(parent.user_id)?.email ?? "",
        role: parent.role as NetworkRole,
      };
    }
  }

  // 지급률(루트 총판 기준)
  let rates: NetworkRateView[] = [];
  if (root) {
    const { data: rateRows } = await admin
      .from("distributor_rates")
      .select("item_type,item_key,rate_pct,active")
      .eq("distributor_user_id", root.user_id);
    rates = (rateRows ?? []).map((r) => ({
      itemType: r.item_type as "subscription_plan" | "product",
      itemKey: r.item_key,
      ratePct: r.rate_pct,
      active: r.active,
    }));
  }

  // 직속 하위
  const { data: children } = await admin
    .from("network_members")
    .select("user_id,role,status")
    .eq("parent_id", userId);
  const childIds = (children ?? []).map((c) => c.user_id);
  const childPm = await profileMap(childIds);
  // 각 하위의 하위 수
  const grandCount = new Map<string, number>();
  if (childIds.length > 0) {
    const { data: grand } = await admin
      .from("network_members")
      .select("parent_id")
      .in("parent_id", childIds);
    for (const g of grand ?? [])
      if (g.parent_id)
        grandCount.set(g.parent_id, (grandCount.get(g.parent_id) ?? 0) + 1);
  }
  const downline: NetworkPerson[] = (children ?? []).map((c) => ({
    userId: c.user_id,
    name: childPm.get(c.user_id)?.name ?? "이름 없음",
    email: childPm.get(c.user_id)?.email ?? "",
    role: c.role as NetworkRole,
    status: c.status,
    childCount: grandCount.get(c.user_id) ?? 0,
  }));

  const clients = await clientsOf(userId);

  // 수당
  const { data: commissions } = await admin
    .from("marketer_commissions")
    .select("*")
    .eq("marketer_id", userId)
    .neq("status", "void")
    .order("occurred_at", { ascending: false });
  const rows = commissions ?? [];
  const { start, end } = monthBounds();
  const inMonth = rows.filter(
    (r) => r.occurred_at >= start && r.occurred_at < end,
  );
  const monthCommission = inMonth.reduce((s, r) => s + r.amount, 0);
  const monthRevenue = inMonth.reduce((s, r) => s + r.gross_sale, 0);
  const totalCommission = rows.reduce((s, r) => s + r.amount, 0);
  const paidCommission = rows
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amount, 0);

  const { data: settlements } = await admin
    .from("marketer_settlements")
    .select("*")
    .eq("marketer_id", userId)
    .order("period", { ascending: false });

  return {
    member: {
      role: member.role as NetworkRole,
      status: member.status,
      split: {
        distributor: (root ?? member).split_distributor,
        agency: (root ?? member).split_agency,
        reseller: (root ?? member).split_reseller,
      },
      distributorId: member.distributor_id,
    },
    upline,
    code,
    rates,
    downline,
    clients,
    monthCommission,
    monthRevenue,
    totalCommission,
    paidCommission,
    recent: rows.slice(0, 40),
    settlements: settlements ?? [],
  };
}

// ---------------- 관리자 조회 ----------------

export interface AdminDistributorItem {
  userId: string;
  name: string;
  email: string;
  status: string;
  payoutType: string;
  split: Split;
  agencyCount: number;
  resellerCount: number;
  pendingCommission: number;
}

export async function listDistributorsAdmin(): Promise<AdminDistributorItem[]> {
  const admin = createAdminClient();
  const { data: members } = await admin.from("network_members").select("*");
  const all = members ?? [];
  const distributors = all.filter((m) => m.role === "distributor");
  if (distributors.length === 0) return [];

  const pm = await profileMap(distributors.map((d) => d.user_id));
  // 서브트리 카운트
  const agencyCount = new Map<string, number>();
  const resellerCount = new Map<string, number>();
  for (const m of all) {
    if (m.role === "agency")
      agencyCount.set(m.distributor_id, (agencyCount.get(m.distributor_id) ?? 0) + 1);
    else if (m.role === "reseller")
      resellerCount.set(
        m.distributor_id,
        (resellerCount.get(m.distributor_id) ?? 0) + 1,
      );
  }
  // 미정산 수당
  const { data: pending } = await admin
    .from("marketer_commissions")
    .select("marketer_id,amount,status")
    .in(
      "marketer_id",
      distributors.map((d) => d.user_id),
    )
    .eq("status", "pending");
  const pendingByUser = new Map<string, number>();
  for (const c of pending ?? [])
    pendingByUser.set(
      c.marketer_id,
      (pendingByUser.get(c.marketer_id) ?? 0) + c.amount,
    );

  return distributors.map((d) => ({
    userId: d.user_id,
    name: pm.get(d.user_id)?.name ?? "이름 없음",
    email: pm.get(d.user_id)?.email ?? "",
    status: d.status,
    payoutType: d.payout_type,
    split: {
      distributor: d.split_distributor,
      agency: d.split_agency,
      reseller: d.split_reseller,
    },
    agencyCount: agencyCount.get(d.user_id) ?? 0,
    resellerCount: resellerCount.get(d.user_id) ?? 0,
    pendingCommission: pendingByUser.get(d.user_id) ?? 0,
  }));
}

export interface AdminDistributorRate {
  itemType: "subscription_plan" | "product";
  itemKey: string;
  ratePct: number;
  active: boolean;
}

/** 특정 총판의 지급률 목록 (관리자 설정 화면용). */
export async function getDistributorRatesAdmin(
  distributorUserId: string,
): Promise<AdminDistributorRate[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("distributor_rates")
    .select("item_type,item_key,rate_pct,active")
    .eq("distributor_user_id", distributorUserId);
  return (data ?? []).map((r) => ({
    itemType: r.item_type as "subscription_plan" | "product",
    itemKey: r.item_key,
    ratePct: r.rate_pct,
    active: r.active,
  }));
}

export interface AdminDistributorRateRow {
  distributorUserId: string;
  itemType: "subscription_plan" | "product";
  itemKey: string;
  ratePct: number;
  active: boolean;
}

/** 모든 총판의 지급률 (관리자 매트릭스용, 1쿼리). */
export async function listAllDistributorRatesAdmin(): Promise<
  AdminDistributorRateRow[]
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("distributor_rates")
    .select("distributor_user_id,item_type,item_key,rate_pct,active");
  return (data ?? []).map((r) => ({
    distributorUserId: r.distributor_user_id,
    itemType: r.item_type as "subscription_plan" | "product",
    itemKey: r.item_key,
    ratePct: r.rate_pct,
    active: r.active,
  }));
}

export interface AdminNetworkReferral {
  clientUserId: string;
  clientName: string;
  clientEmail: string;
  sellerName: string;
  sellerEmail: string;
  sellerRole: NetworkRole;
  signupAt: string;
  plan: string;
  paying: boolean;
}

/** 네트워크 멤버 추천으로 가입한 사람들. */
export async function listNetworkReferralsAdmin(
  limit = 500,
): Promise<AdminNetworkReferral[]> {
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("network_members")
    .select("user_id,role");
  const roleByUser = new Map(
    (members ?? []).map((m) => [m.user_id, m.role as NetworkRole]),
  );
  const memberIds = [...roleByUser.keys()];
  if (memberIds.length === 0) return [];

  const { data: refs } = await admin
    .from("referrals")
    .select("referred_user_id,referrer_user_id,created_at")
    .in("referrer_user_id", memberIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  const list = refs ?? [];
  if (list.length === 0) return [];

  const clientIds = [...new Set(list.map((r) => r.referred_user_id))];
  const [clientPm, sellerPm, { data: subs }] = await Promise.all([
    profileMap(clientIds),
    profileMap(memberIds),
    admin
      .from("subscriptions")
      .select("user_id,plan,status,trial,billing_key")
      .in("user_id", clientIds),
  ]);
  const subByUser = new Map((subs ?? []).map((s) => [s.user_id, s]));

  return list.map((r) => {
    const s = subByUser.get(r.referred_user_id);
    const paying = !!s && s.status === "active" && !s.trial && !!s.billing_key;
    return {
      clientUserId: r.referred_user_id,
      clientName: clientPm.get(r.referred_user_id)?.name ?? "이름 없음",
      clientEmail: clientPm.get(r.referred_user_id)?.email ?? "",
      sellerName: sellerPm.get(r.referrer_user_id)?.name ?? "이름 없음",
      sellerEmail: sellerPm.get(r.referrer_user_id)?.email ?? "",
      sellerRole: roleByUser.get(r.referrer_user_id) ?? "reseller",
      signupAt: r.created_at,
      plan: s?.plan ?? "free",
      paying,
    };
  });
}
