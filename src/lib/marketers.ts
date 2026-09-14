import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPlanById, type PlanId } from "@/lib/plans";
import type {
  MarketerRow,
  MarketerCommissionRow,
  MarketerSettlementRow,
} from "@/types/database";

/**
 * 마케터(리셀러/메이커) 시스템.
 * - 직급은 동적: 유지중 정기결제 클라이언트 10명 이상 = MAKER, 미만 = RESELLER.
 * - 귀속: 구독은 referrals(추천코드), 상품은 product_orders.ref_marketer_id.
 * - 수당은 결제 성공 시 판매시점 직급 기준으로 스냅샷 적립(멱등). 구독은 매 결제마다 반복.
 * - 모든 쓰기는 service role. 조회 게이팅만 세션 클라이언트 사용.
 */

export const MAKER_THRESHOLD = 10; // 유지중 정기결제 클라이언트 수
const FREELANCER_TAX_RATE = 0.033; // 3.3% 원천징수

export type Rank = "RESELLER" | "MAKER";

// 추천코드 생성/조회 — referral.ts와 동일 규격이지만 순환 import를 피하려 여기 복제.
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

// ---------------- 조회 · 게이팅 ----------------

export async function getMarketer(userId: string): Promise<MarketerRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("marketers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/** 현재 로그인 사용자가 활성 마케터인지 (대시보드 노출 게이팅). */
export async function isCurrentUserMarketer(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("marketers")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    return data?.status === "active";
  } catch {
    return false;
  }
}

/** 추천코드로 활성 마케터를 찾는다 (상품 결제링크 ?ref= 귀속용). */
export async function resolveActiveMarketerByCode(
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
  const { data: m } = await admin
    .from("marketers")
    .select("user_id,status")
    .eq("user_id", profile.user_id)
    .maybeSingle();
  return m?.status === "active" ? profile.user_id : null;
}

/** 마케터에게 귀속된 클라이언트 user_id 목록 (추천 = referrals). */
async function getReferredUserIds(marketerId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("referrals")
    .select("referred_user_id")
    .eq("referrer_user_id", marketerId);
  return (data ?? []).map((r) => r.referred_user_id);
}

export interface MarketerStanding {
  rank: Rank;
  activeClients: number; // 유지중 정기결제 클라이언트 수
  toMaker: number; // MAKER까지 남은 인원 (0이면 이미 MAKER)
}

/** 직급 판정 — 유지중(유료·비체험) 정기결제 클라이언트 수 기준. */
export async function computeMarketerStanding(
  marketerId: string,
): Promise<MarketerStanding> {
  const admin = createAdminClient();
  const ids = await getReferredUserIds(marketerId);
  let activeClients = 0;
  if (ids.length > 0) {
    const { count } = await admin
      .from("subscriptions")
      .select("user_id", { count: "exact", head: true })
      .in("user_id", ids)
      .eq("status", "active")
      .eq("trial", false)
      .not("billing_key", "is", null);
    activeClients = count ?? 0;
  }
  const rank: Rank = activeClients >= MAKER_THRESHOLD ? "MAKER" : "RESELLER";
  return {
    rank,
    activeClients,
    toMaker: Math.max(0, MAKER_THRESHOLD - activeClients),
  };
}

/** 캐시된 marketers.rank를 최신 판정으로 갱신 (표시용). */
export async function refreshMarketerRank(marketerId: string): Promise<Rank> {
  const { rank } = await computeMarketerStanding(marketerId);
  const admin = createAdminClient();
  await admin
    .from("marketers")
    .update({ rank, updated_at: new Date().toISOString() })
    .eq("user_id", marketerId);
  return rank;
}

// ---------------- 수당 정책 조회 ----------------

/** (상품/플랜 × 직급) 수당 금액. 미설정/비활성이면 0. */
export async function getRewardAmount(
  itemType: "subscription_plan" | "product",
  itemKey: string,
  rank: Rank,
): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("marketer_rewards")
    .select("reward_amount,active")
    .eq("item_type", itemType)
    .eq("item_key", itemKey)
    .eq("rank", rank)
    .maybeSingle();
  return data?.active ? data.reward_amount : 0;
}

// ---------------- 수당 적립 (결제 성공 시) ----------------

/**
 * 구독 결제 1건에 대한 수당 적립 (멱등: payment_id 유니크).
 * chargeOnce가 PAID로 확정한 직후 호출된다 — 매월 재결제마다 반복 적립.
 */
export async function accrueSubscriptionCommission(args: {
  paymentId: string; // payments.id (uuid)
  clientUserId: string;
  planId: PlanId;
  amount: number;
  occurredAt?: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    // 귀속 마케터 찾기
    const { data: ref } = await admin
      .from("referrals")
      .select("referrer_user_id")
      .eq("referred_user_id", args.clientUserId)
      .maybeSingle();
    if (!ref) return;
    const marketer = await getMarketer(ref.referrer_user_id);
    if (!marketer || marketer.status !== "active") return;

    const { rank } = await computeMarketerStanding(marketer.user_id);
    const reward = await getRewardAmount("subscription_plan", args.planId, rank);
    if (reward <= 0) return;

    const { error } = await admin.from("marketer_commissions").insert({
      marketer_id: marketer.user_id,
      source_type: "subscription",
      payment_id: args.paymentId,
      client_user_id: args.clientUserId,
      item_key: args.planId,
      item_label: `${getPlanById(args.planId).name.ko} 구독`,
      rank_at_sale: rank,
      gross_sale: args.amount,
      amount: reward,
      status: "pending",
      occurred_at: args.occurredAt ?? new Date().toISOString(),
    });
    if (error && error.code !== "23505")
      console.error("[marketers] sub commission failed", args.paymentId, error);
  } catch (err) {
    console.error("[marketers] accrueSubscriptionCommission error", err);
  }
}

/**
 * 상품 주문 1건에 대한 수당 적립 (멱등: product_order_id 유니크).
 * syncProductOrder가 PAID로 확정한 뒤 호출된다.
 */
export async function accrueProductCommission(orderId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("product_orders")
      .select("id,status,ref_marketer_id,product_id,product_name,amount")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!order || order.status !== "PAID" || !order.ref_marketer_id) return;
    if (!order.product_id) return; // 삭제된 상품은 수당표 매칭 불가

    const marketer = await getMarketer(order.ref_marketer_id);
    if (!marketer || marketer.status !== "active") return;

    const { rank } = await computeMarketerStanding(marketer.user_id);
    const reward = await getRewardAmount("product", order.product_id, rank);
    if (reward <= 0) return;

    const { error } = await admin.from("marketer_commissions").insert({
      marketer_id: marketer.user_id,
      source_type: "product",
      product_order_id: order.id,
      item_key: order.product_id,
      item_label: order.product_name,
      rank_at_sale: rank,
      gross_sale: order.amount,
      amount: reward,
      status: "pending",
      occurred_at: new Date().toISOString(),
    });
    if (error && error.code !== "23505")
      console.error("[marketers] product commission failed", orderId, error);
  } catch (err) {
    console.error("[marketers] accrueProductCommission error", err);
  }
}

// ---------------- 마케터 대시보드 ----------------

export interface MarketerClient {
  userId: string;
  name: string;
  email: string;
  plan: string;
  status: string; // subscription status
  paying: boolean; // 유지중 정기결제 여부
}

export interface MarketerDashboard {
  standing: MarketerStanding;
  code: string | null;
  clients: MarketerClient[];
  monthRevenue: number;
  monthCommission: number;
  totalCommission: number;
  paidCommission: number;
  recent: MarketerCommissionRow[];
  settlements: MarketerSettlementRow[];
}

function monthRange(period?: string): { start: string; end: string; label: string } {
  const now = period ? new Date(`${period}-01T00:00:00`) : new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  return { start: start.toISOString(), end: end.toISOString(), label };
}

export async function getMarketerDashboard(
  userId: string,
): Promise<MarketerDashboard> {
  const admin = createAdminClient();
  const standing = await computeMarketerStanding(userId);
  // 캐시 갱신 (표시 일관성)
  await admin
    .from("marketers")
    .update({ rank: standing.rank, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  const code = await ensureReferralCode(userId);

  // 클라이언트 목록
  const ids = await getReferredUserIds(userId);
  let clients: MarketerClient[] = [];
  if (ids.length > 0) {
    const [{ data: profiles }, { data: subs }] = await Promise.all([
      admin.from("profiles").select("user_id,name,email").in("user_id", ids),
      admin
        .from("subscriptions")
        .select("user_id,plan,status,trial,billing_key")
        .in("user_id", ids),
    ]);
    const subByUser = new Map((subs ?? []).map((s) => [s.user_id, s]));
    clients = (profiles ?? []).map((p) => {
      const s = subByUser.get(p.user_id);
      const paying =
        !!s && s.status === "active" && !s.trial && !!s.billing_key;
      return {
        userId: p.user_id,
        name: p.name ?? "이름 없음",
        email: p.email ?? "",
        plan: s?.plan ?? "free",
        status: s?.status ?? "none",
        paying,
      };
    });
  }

  // 수당 집계
  const { data: commissions } = await admin
    .from("marketer_commissions")
    .select("*")
    .eq("marketer_id", userId)
    .neq("status", "void")
    .order("occurred_at", { ascending: false });
  const rows = commissions ?? [];
  const { start, end } = monthRange();
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
    standing,
    code,
    clients,
    monthRevenue,
    monthCommission,
    totalCommission,
    paidCommission,
    recent: rows.slice(0, 30),
    settlements: settlements ?? [],
  };
}

// ---------------- 관리자 조회 ----------------

export interface AdminMarketerItem {
  userId: string;
  name: string;
  email: string;
  status: string;
  payoutType: string;
  rank: Rank;
  activeClients: number;
  pendingCommission: number;
}

export async function listMarketersAdmin(): Promise<AdminMarketerItem[]> {
  const admin = createAdminClient();
  const { data: marketers } = await admin.from("marketers").select("*");
  const list = marketers ?? [];
  if (list.length === 0) return [];

  const ids = list.map((m) => m.user_id);
  const [{ data: profiles }, { data: pending }] = await Promise.all([
    admin.from("profiles").select("user_id,name,email").in("user_id", ids),
    admin
      .from("marketer_commissions")
      .select("marketer_id,amount,status")
      .in("marketer_id", ids)
      .eq("status", "pending"),
  ]);
  const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const pendingByUser = new Map<string, number>();
  for (const c of pending ?? [])
    pendingByUser.set(
      c.marketer_id,
      (pendingByUser.get(c.marketer_id) ?? 0) + c.amount,
    );

  const out: AdminMarketerItem[] = [];
  for (const m of list) {
    const standing = await computeMarketerStanding(m.user_id);
    out.push({
      userId: m.user_id,
      name: byUser.get(m.user_id)?.name ?? "이름 없음",
      email: byUser.get(m.user_id)?.email ?? "",
      status: m.status,
      payoutType: m.payout_type,
      rank: standing.rank,
      activeClients: standing.activeClients,
      pendingCommission: pendingByUser.get(m.user_id) ?? 0,
    });
  }
  return out;
}

export async function getMarketerRewardsAdmin() {
  const admin = createAdminClient();
  const { data } = await admin.from("marketer_rewards").select("*");
  return data ?? [];
}

export async function listSettlementsAdmin(): Promise<
  (MarketerSettlementRow & { name: string; email: string })[]
> {
  const admin = createAdminClient();
  const { data: settlements } = await admin
    .from("marketer_settlements")
    .select("*")
    .order("period", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  const list = settlements ?? [];
  if (list.length === 0) return [];
  const ids = [...new Set(list.map((s) => s.marketer_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id,name,email")
    .in("user_id", ids);
  const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return list.map((s) => ({
    ...s,
    name: byUser.get(s.marketer_id)?.name ?? "이름 없음",
    email: byUser.get(s.marketer_id)?.email ?? "",
  }));
}

// ---------------- 관리자 조작 (액션에서 호출) ----------------

/** 유저를 마케터로 지정/해제. */
export async function setMarketerByEmail(
  email: string,
  enable: boolean,
  payoutType: "freelancer" | "business",
): Promise<{ ok?: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id,name")
    .eq("email", email.trim())
    .maybeSingle();
  if (!profile) return { error: "해당 이메일의 사용자를 찾을 수 없습니다." };

  if (enable) {
    // 추천코드 미리 생성(마케터 링크로 사용)
    await ensureReferralCode(profile.user_id);
    const { error } = await admin.from("marketers").upsert(
      {
        user_id: profile.user_id,
        status: "active",
        payout_type: payoutType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error)
      return {
        error:
          "마케터 지정에 실패했습니다. (0023 마이그레이션이 적용됐는지 확인해주세요)",
      };
    return { ok: true };
  }

  const { error } = await admin
    .from("marketers")
    .update({ status: "suspended", updated_at: new Date().toISOString() })
    .eq("user_id", profile.user_id);
  if (error) return { error: "해제에 실패했습니다." };
  return { ok: true };
}

/** 직급별 상품 수당 저장 (upsert). */
export async function saveMarketerReward(args: {
  itemType: "subscription_plan" | "product";
  itemKey: string;
  rank: Rank;
  amount: number;
  active: boolean;
}): Promise<{ ok?: boolean; error?: string }> {
  if (!Number.isInteger(args.amount) || args.amount < 0)
    return { error: "수당 금액이 올바르지 않습니다." };
  const admin = createAdminClient();
  const { error } = await admin.from("marketer_rewards").upsert(
    {
      item_type: args.itemType,
      item_key: args.itemKey,
      rank: args.rank,
      reward_amount: args.amount,
      active: args.active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "item_type,item_key,rank" },
  );
  if (error) return { error: "수당 저장에 실패했습니다." };
  return { ok: true };
}

/**
 * 월별 정산 생성 — 해당 월 pending 수당을 마케터별로 묶어 settlement 생성.
 * 프리랜서는 3.3% 원천징수 후 순액 계산. 이미 지급완료된 배치는 건드리지 않는다.
 */
export async function generateSettlements(
  period: string,
): Promise<{ ok?: boolean; error?: string; created?: number }> {
  if (!/^\d{4}-\d{2}$/.test(period))
    return { error: "정산 월 형식이 올바르지 않습니다. (예: 2026-09)" };
  const admin = createAdminClient();
  const { start, end, label } = monthRange(period);

  const { data: pending } = await admin
    .from("marketer_commissions")
    .select("id,marketer_id,amount")
    .eq("status", "pending")
    .gte("occurred_at", start)
    .lt("occurred_at", end);
  const rows = pending ?? [];
  if (rows.length === 0) return { ok: true, created: 0 };

  // 마케터별 그룹
  const byMarketer = new Map<string, { ids: string[]; gross: number }>();
  for (const r of rows) {
    const g = byMarketer.get(r.marketer_id) ?? { ids: [], gross: 0 };
    g.ids.push(r.id);
    g.gross += r.amount;
    byMarketer.set(r.marketer_id, g);
  }

  let created = 0;
  for (const [marketerId, g] of byMarketer) {
    const marketer = await getMarketer(marketerId);
    const payoutType = marketer?.payout_type ?? "freelancer";

    // 기존 배치 확인
    const { data: existing } = await admin
      .from("marketer_settlements")
      .select("*")
      .eq("marketer_id", marketerId)
      .eq("period", label)
      .maybeSingle();
    if (existing?.status === "paid") continue; // 지급완료 건은 보존

    const gross = (existing?.gross ?? 0) + g.gross;
    const count = (existing?.commission_count ?? 0) + g.ids.length;
    const tax =
      payoutType === "freelancer" ? Math.round(gross * FREELANCER_TAX_RATE) : 0;
    const net = gross - tax;

    const { data: settlement, error: upErr } = await admin
      .from("marketer_settlements")
      .upsert(
        {
          ...(existing ? { id: existing.id } : {}),
          marketer_id: marketerId,
          period: label,
          payout_type: payoutType,
          gross,
          tax,
          net,
          commission_count: count,
          status: "open",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "marketer_id,period" },
      )
      .select("id")
      .single();
    if (upErr || !settlement) {
      console.error("[marketers] settlement upsert failed", marketerId, upErr);
      continue;
    }

    await admin
      .from("marketer_commissions")
      .update({ status: "settled", settlement_id: settlement.id })
      .in("id", g.ids);
    created++;
  }

  return { ok: true, created };
}

/** 정산 배치 지급완료 처리 — 배치 + 소속 수당을 paid로. */
export async function markSettlementPaid(
  settlementId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("marketer_settlements")
    .update({ status: "paid", paid_at: now, updated_at: now })
    .eq("id", settlementId);
  if (error) return { error: "지급 처리에 실패했습니다." };
  await admin
    .from("marketer_commissions")
    .update({ status: "paid" })
    .eq("settlement_id", settlementId);
  return { ok: true };
}
