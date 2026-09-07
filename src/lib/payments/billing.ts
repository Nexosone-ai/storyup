import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import {
  payWithBillingKey,
  getPortonePayment,
  deleteBillingKey,
  PaymentProviderError,
} from "@/lib/payments/portone";
import { getPlanById, type PlanId } from "@/lib/plans";
import { ensureMonthlyGrant } from "@/lib/subscription";
import { markReferralPaidConversion } from "@/lib/gamification/referral";

/**
 * 정기결제(빌링키) 구독 서비스.
 * - 가격은 항상 서버(plans.ts)가 결정한다. 클라이언트 금액은 신뢰하지 않는다.
 * - 매 청구는 payments에 kind='subscription' 행으로 감사 기록.
 * - 포인트 적립은 기존 grant_plan_points(월 1회 멱등)만 사용 — 이중 지급 없음.
 * - 갱신은 /api/cron/billing이 매일 실행: 기간 만료 구독을 청구하거나 종료.
 */

const PAID_PLANS: PlanId[] = ["basic", "pro"];
const MAX_BILLING_FAILURES = 3;

export interface BillingResult {
  ok?: boolean;
  error?: string;
}

function addOneMonth(fromIso?: string | null): string {
  // 기준: 기존 만료일이 아직 미래면 거기서 +1개월(결제일 유지), 지났으면 지금부터.
  const base =
    fromIso && new Date(fromIso).getTime() > Date.now()
      ? new Date(fromIso)
      : new Date();
  base.setMonth(base.getMonth() + 1);
  return base.toISOString();
}

/** 구독 행 조회 (없으면 null). 0017 이전 DB에서는 null. */
export async function getSubscriptionRow(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/**
 * 빌링키 1회 청구 + 검증. 성공 시 payments 행이 PAID로 남는다.
 * 실패 시 { error } 반환 (throw하지 않음 — 크론 루프 안정성).
 */
async function chargeOnce(args: {
  userId: string;
  planId: PlanId;
  billingKey: string;
  reason: string;
}): Promise<BillingResult> {
  const admin = createAdminClient();
  const plan = getPlanById(args.planId);
  if (plan.priceKrw === null || plan.priceKrw <= 0)
    return { error: "결제형 플랜이 아닙니다." };

  const orderId = `sub_${randomUUID()}`;
  const orderName = `STORYUP ${plan.name.ko} 플랜 (월)`;

  // 감사용 주문 행 먼저 (PENDING) — credits=0: 구독은 포인트 적립이 아님
  const { data: paymentRow, error: insErr } = await admin
    .from("payments")
    .insert({
      user_id: args.userId,
      order_id: orderId,
      amount: plan.priceKrw,
      currency: "KRW",
      credits: 0,
      bonus_credits: 0,
      status: "PENDING",
      metadata: { kind: "subscription", plan: args.planId, reason: args.reason },
    })
    .select("id")
    .single();
  if (insErr || !paymentRow) {
    console.error("[billing] payment insert failed", insErr);
    return { error: "주문 생성에 실패했습니다." };
  }

  try {
    await payWithBillingKey({
      paymentId: orderId,
      billingKey: args.billingKey,
      orderName,
      amount: plan.priceKrw,
      customerId: args.userId,
    });
  } catch (err) {
    const detail =
      err instanceof PaymentProviderError ? err.message : "결제 요청 실패";
    await admin
      .from("payments")
      .update({ status: "FAILED", updated_at: new Date().toISOString() })
      .eq("id", paymentRow.id);
    console.error("[billing] charge failed", args.userId, args.planId, err);
    return { error: `카드 결제에 실패했습니다. (${detail})` };
  }

  // PortOne 재조회로 금액·상태 검증 (신뢰 경계는 항상 서버 조회)
  try {
    const remote = await getPortonePayment(orderId);
    if (remote.status !== "PAID" || remote.amount?.total !== plan.priceKrw) {
      await admin
        .from("payments")
        .update({ status: "FAILED", updated_at: new Date().toISOString() })
        .eq("id", paymentRow.id);
      return { error: "결제 검증에 실패했습니다." };
    }
    await admin
      .from("payments")
      .update({
        status: "PAID",
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payment_key: remote.id,
        transaction_id: remote.transactionId ?? null,
        payment_method: remote.method?.type ?? "CARD",
      })
      .eq("id", paymentRow.id);
  } catch (err) {
    // 결제는 됐는데 검증 조회만 실패한 경우 — 웹훅/재동기화가 정리한다
    console.error("[billing] verify failed", orderId, err);
  }

  return { ok: true };
}

/**
 * 구독 시작/플랜 변경 — 빌링키 등록 직후 호출된다.
 * 즉시 1개월분을 결제하고 오늘부터 1개월 구독을 설정한다.
 */
export async function startSubscription(
  userId: string,
  planId: PlanId,
  billingKey: string,
): Promise<BillingResult> {
  if (!PAID_PLANS.includes(planId))
    return { error: "구독할 수 없는 플랜입니다." };
  if (!billingKey) return { error: "카드 등록 정보가 없습니다." };

  const charged = await chargeOnce({
    userId,
    planId,
    billingKey,
    reason: "subscribe",
  });
  if (!charged.ok) return charged;

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("subscriptions").upsert({
    user_id: userId,
    plan: planId,
    status: "active",
    billing_key: billingKey,
    // 구독 시작은 항상 오늘부터 1개월 (체험 기간과 무관하게 즉시 전환)
    current_period_end: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d.toISOString();
    })(),
    cancel_at_period_end: false,
    billing_failures: 0,
    trial: false,
    updated_at: now,
  });
  if (error) {
    // 결제는 성공했는데 구독 기록 실패 — 로그 남기고 관리자 개입 필요
    console.error("[billing] subscription upsert failed AFTER charge", userId, error);
    return {
      error:
        "결제는 완료됐지만 구독 반영에 문제가 발생했습니다. 고객센터로 문의해주세요.",
    };
  }

  // 이번 달 플랜 포인트 즉시 지급 (월 멱등)
  await ensureMonthlyGrant(userId, planId);
  // 추천인 유료 전환 보상 (1회 멱등, 실패 무시)
  try {
    await markReferralPaidConversion(userId);
  } catch {
    /* 보상 실패는 결제 흐름에 영향 없음 */
  }
  return { ok: true };
}

/** 해지 예약 — 남은 기간은 유지, 다음 결제만 중단. */
export async function cancelAtPeriodEnd(userId: string): Promise<BillingResult> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active");
  return error ? { error: "해지 예약에 실패했습니다." } : { ok: true };
}

/** 해지 예약 취소 — 기간 내라면 구독이 그대로 이어진다. */
export async function resumeSubscription(userId: string): Promise<BillingResult> {
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("billing_key, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!sub || sub.status !== "active" || !sub.billing_key)
    return { error: "재개할 구독이 없습니다." };
  const { error } = await admin
    .from("subscriptions")
    .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return error ? { error: "재개에 실패했습니다." } : { ok: true };
}

/**
 * 만기 구독 일괄 처리 (크론 전용).
 * - 해지 예약/빌링키 없음(체험 포함) → 종료
 * - 빌링키 있음 → 재청구, 3회 연속 실패 시 past_due로 전환
 */
export async function runBillingCycle(): Promise<{
  renewed: number;
  ended: number;
  failed: number;
}> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: due, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .not("current_period_end", "is", null)
    .lt("current_period_end", nowIso)
    .limit(200);
  if (error) {
    console.error("[billing] due query failed", error.message);
    return { renewed: 0, ended: 0, failed: 0 };
  }

  let renewed = 0,
    ended = 0,
    failed = 0;

  for (const sub of due ?? []) {
    const userId = sub.user_id as string;
    try {
      if (sub.cancel_at_period_end || !sub.billing_key) {
        // 체험 종료 또는 해지 예약 도래 — free로
        await admin
          .from("subscriptions")
          .update({
            status: sub.billing_key ? "canceled" : "expired",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        // 해지 완료된 빌링키는 폐기 (카드 정보 보관 최소화)
        if (sub.cancel_at_period_end && sub.billing_key) {
          try {
            await deleteBillingKey(sub.billing_key);
            await admin
              .from("subscriptions")
              .update({ billing_key: null })
              .eq("user_id", userId);
          } catch {
            /* 삭제 실패는 다음 기회에 */
          }
        }
        ended++;
        continue;
      }

      const res = await chargeOnce({
        userId,
        planId: sub.plan as PlanId,
        billingKey: sub.billing_key,
        reason: "renewal",
      });
      if (res.ok) {
        await admin
          .from("subscriptions")
          .update({
            current_period_end: addOneMonth(sub.current_period_end),
            billing_failures: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        await ensureMonthlyGrant(userId, sub.plan as PlanId);
        renewed++;
      } else {
        const failures = (sub.billing_failures ?? 0) + 1;
        await admin
          .from("subscriptions")
          .update({
            billing_failures: failures,
            ...(failures >= MAX_BILLING_FAILURES ? { status: "past_due" } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        failed++;
      }
    } catch (err) {
      console.error("[billing] cycle item failed", userId, err);
      failed++;
    }
  }

  return { renewed, ended, failed };
}
