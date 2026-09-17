import { createAdminClient } from "@/lib/supabase/server";
import { getPlanById, type PlanId } from "@/lib/plans";
import { ensureMonthlyGrant } from "@/lib/subscription";
import { markReferralPaidConversion } from "@/lib/gamification/referral";

/**
 * 계좌이체 결제 신청 — PG 정식 오픈 전 수동 승인 경로.
 * 사용자가 계좌이체로 구독을 신청하면 관리자가 입금 확인 후 승인한다.
 * 승인 시 subscriptions를 plan/active/current_period_end=+1개월로 설정하고
 * (빌링키 없음) 이번 달 플랜 포인트를 지급한다. 만기 시 크론이 expired 처리.
 */

const PAID_PLANS: PlanId[] = ["basic", "pro"];

export interface BankTransferResult {
  ok?: boolean;
  error?: string;
}

export interface PendingBankTransfer {
  id: string;
  plan: PlanId;
  amount: number;
  depositorName: string;
  createdAt: string;
}

/** 사용자의 처리 대기(PENDING) 신청. 없거나 조회 실패 시 null. */
export async function getPendingBankTransfer(
  userId: string,
): Promise<PendingBankTransfer | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bank_transfer_requests")
    .select("id, plan, amount, depositor_name, created_at")
    .eq("user_id", userId)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    plan: data.plan as PlanId,
    amount: data.amount,
    depositorName: data.depositor_name,
    createdAt: data.created_at,
  };
}

/**
 * 계좌이체 신청 생성. 금액은 항상 서버(plans.ts)가 정한다.
 * 이미 대기 중인 신청이 있으면 중복 생성하지 않는다.
 */
export async function createBankTransferRequest(
  userId: string,
  planId: PlanId,
  depositorName: string,
): Promise<BankTransferResult> {
  if (!PAID_PLANS.includes(planId))
    return { error: "구독할 수 없는 플랜입니다." };
  const name = depositorName.trim();
  if (!name) return { error: "입금자명을 입력해주세요." };

  const plan = getPlanById(planId);
  if (plan.priceKrw === null || plan.priceKrw <= 0)
    return { error: "결제형 플랜이 아닙니다." };

  const admin = createAdminClient();

  // 중복 방지 — 이미 대기 중인 신청이 있으면 그대로 안내
  const existing = await getPendingBankTransfer(userId);
  if (existing)
    return {
      error: "이미 입금 확인 대기 중인 신청이 있습니다. 확인 후 활성화됩니다.",
    };

  const { error } = await admin.from("bank_transfer_requests").insert({
    user_id: userId,
    plan: planId,
    amount: plan.priceKrw,
    depositor_name: name,
    status: "PENDING",
  });
  if (error) {
    console.error("[bankTransfer] insert failed", userId, error.message);
    return {
      error:
        "신청 접수에 실패했습니다. (0029 마이그레이션이 적용됐는지 확인해주세요)",
    };
  }
  return { ok: true };
}

export interface AdminBankTransferItem {
  id: string;
  userName: string;
  userEmail: string;
  plan: string;
  amount: number;
  depositorName: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/** 관리자용 신청 목록 — 대기 건이 위로 오도록 정렬. */
export async function listBankTransferRequests(
  limit = 100,
): Promise<AdminBankTransferItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bank_transfer_requests")
    .select(
      "id, user_id, plan, amount, depositor_name, status, admin_note, created_at, reviewed_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const userIds = [...new Set(data.map((r) => r.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, name, email")
    .in("user_id", userIds);
  const byId = new Map(
    (profiles ?? []).map((p) => [p.user_id, p]),
  );

  const rows = data.map((r) => ({
    id: r.id,
    userName: byId.get(r.user_id)?.name ?? "이름 없음",
    userEmail: byId.get(r.user_id)?.email ?? "",
    plan: r.plan,
    amount: r.amount,
    depositorName: r.depositor_name,
    status: r.status,
    adminNote: r.admin_note,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  }));
  // 대기(PENDING) 우선, 그다음 최신순
  return rows.sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") return -1;
    if (a.status !== "PENDING" && b.status === "PENDING") return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * 신청 승인 — 입금 확인 후 구독을 1개월 활성화한다.
 * 카드 구독과 달리 billing_key가 없으므로 만기 시 자동 종료된다(수동 월 결제).
 */
export async function approveBankTransfer(
  requestId: string,
  reviewerId: string,
): Promise<BankTransferResult> {
  const admin = createAdminClient();
  const { data: req, error } = await admin
    .from("bank_transfer_requests")
    .select("id, user_id, plan, status")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !req) return { error: "신청을 찾을 수 없습니다." };
  if (req.status !== "PENDING")
    return { error: "이미 처리된 신청입니다." };

  const planId = req.plan as PlanId;
  const userId = req.user_id as string;
  const end = new Date();
  end.setMonth(end.getMonth() + 1);

  const { error: subErr } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: planId,
      status: "active",
      current_period_end: end.toISOString(),
      billing_key: null, // 계좌이체는 정기결제가 아님 — 만기 시 크론이 종료
      cancel_at_period_end: false,
      billing_failures: 0,
      trial: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (subErr) {
    console.error("[bankTransfer] subscription upsert failed", userId, subErr);
    return {
      error:
        "구독 반영에 실패했습니다. (0012/0017 마이그레이션 확인이 필요합니다)",
    };
  }

  await admin
    .from("bank_transfer_requests")
    .update({
      status: "APPROVED",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  // 이번 달 플랜 포인트 지급 (월 멱등) + 추천인 유료 전환 보상 (1회 멱등)
  await ensureMonthlyGrant(userId, planId);
  try {
    await markReferralPaidConversion(userId);
  } catch {
    /* 보상 실패는 활성화에 영향 없음 */
  }
  return { ok: true };
}

/** 신청 거절 — 사유(선택)를 기록한다. 구독은 변경하지 않는다. */
export async function rejectBankTransfer(
  requestId: string,
  reviewerId: string,
  note: string,
): Promise<BankTransferResult> {
  const admin = createAdminClient();
  const { data: req } = await admin
    .from("bank_transfer_requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return { error: "신청을 찾을 수 없습니다." };
  if (req.status !== "PENDING") return { error: "이미 처리된 신청입니다." };

  const { error } = await admin
    .from("bank_transfer_requests")
    .update({
      status: "REJECTED",
      admin_note: note.trim() || null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  return error ? { error: "거절 처리에 실패했습니다." } : { ok: true };
}
