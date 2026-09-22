import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import {
  payWithBillingKey,
  getPortonePayment,
  deleteBillingKey,
  PaymentProviderError,
} from "@/lib/payments/portone";
import { getPlanById, type PlanId } from "@/lib/plans";
import { markReferralPaidConversion } from "@/lib/gamification/referral";
import { accrueSubscriptionCommission } from "@/lib/marketers";

/**
 * 정기결제(빌링키) 구독 서비스.
 * - 가격은 항상 서버(plans.ts)가 결정한다. 클라이언트 금액은 신뢰하지 않는다.
 * - 매 청구는 payments에 kind='subscription' 행으로 감사 기록.
 * - 구독 결제로 UP 포인트를 자동 지급하지 않는다. (월 UP 지급 정책 폐지)
 * - 갱신은 /api/cron/billing이 매일 실행: 기간 만료 구독을 청구하거나 종료.
 */

const PAID_PLANS: PlanId[] = ["basic", "pro"];
const MAX_BILLING_FAILURES = 3;

/**
 * 베타 기간 신규 가입 자동 Pro 체험 — 2026-09-22 00:00(KST)부터 종료.
 * 이후 신규 가입은 구독 행 없이 시작하므로 getPlanId가 기본 Free를 반환한다.
 * 컷오프 전 가입자만 1개월 Pro 체험을 받는다 (결제 없음).
 */
const AUTO_TRIAL_UNTIL = Date.parse("2026-09-22T00:00:00+09:00");
const TRIAL_PLAN: PlanId = "pro";

export async function ensureTrialSubscription(userId: string): Promise<void> {
  if (Date.now() >= AUTO_TRIAL_UNTIL) return; // 컷오프 이후 신규 가입은 Free
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || data) return; // 조회 실패(마이그레이션 전) 또는 이미 구독/체험 있음

    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    // 동시 호출 대비: 이미 행이 생겼다면 조용히 무시
    const { error: insErr } = await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        plan: TRIAL_PLAN,
        status: "active",
        current_period_end: end.toISOString(),
        trial: true,
      },
      { ignoreDuplicates: true },
    );
    if (insErr) return;
  } catch (err) {
    console.error("[billing] ensureTrialSubscription failed", userId, err);
  }
}

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

    // 마케터 수당 적립 (매 결제마다 반복, payment_id 유니크로 멱등). 실패는 결제에 영향 없음.
    await accrueSubscriptionCommission({
      paymentId: paymentRow.id,
      clientUserId: args.userId,
      planId: args.planId,
      amount: plan.priceKrw,
    });
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

  // 추천인 유료 전환 보상 (1회 멱등, 실패 무시)
  try {
    await markReferralPaidConversion(userId);
  } catch {
    /* 보상 실패는 결제 흐름에 영향 없음 */
  }
  return { ok: true };
}

// ---------------- 실시간 계좌이체 구독 (PG 즉시 확정, 자동갱신 없음) ----------------

export interface TransferOrder {
  orderId: string; // = PortOne paymentId (sub_…)
  orderName: string;
  amount: number;
  storeId: string;
  channelKey: string;
}

/**
 * 실시간 계좌이체 구독 주문 생성 — 결제창을 열기 직전 PENDING payments 행을 만든다.
 * 금액은 항상 서버(plans.ts)가 정한다. 결제 확정(PAID) 시 activateTransferSubscription이
 * 구독을 1개월 활성화한다(빌링키 없음 → 만기 시 크론이 종료, 매월 수동 재결제).
 */
export async function createTransferSubscriptionOrder(
  userId: string,
  planId: PlanId,
): Promise<{ order?: TransferOrder; error?: string }> {
  if (!PAID_PLANS.includes(planId))
    return { error: "구독할 수 없는 플랜입니다." };

  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  // 실시간 계좌이체는 '일반결제' 채널을 쓴다 (빌링/정기결제 채널과 별개).
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  if (!storeId || !channelKey || !process.env.PORTONE_API_SECRET)
    return { error: "결제 설정이 완료되지 않았습니다. 잠시 후 다시 시도해주세요." };

  const plan = getPlanById(planId);
  if (plan.priceKrw === null || plan.priceKrw <= 0)
    return { error: "결제형 플랜이 아닙니다." };

  const orderId = `sub_${randomUUID()}`;
  const orderName = `STORYUP ${plan.name.ko} 플랜 (월)`;

  const admin = createAdminClient();
  const { error } = await admin.from("payments").insert({
    user_id: userId,
    order_id: orderId,
    amount: plan.priceKrw,
    currency: "KRW",
    credits: 0,
    bonus_credits: 0,
    status: "PENDING",
    metadata: {
      kind: "subscription",
      plan: planId,
      reason: "transfer_subscribe",
      method: "transfer",
    },
  });
  if (error) {
    console.error("[billing] transfer order insert failed", userId, error);
    return { error: "주문 생성에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  return {
    order: { orderId, orderName, amount: plan.priceKrw, storeId, channelKey },
  };
}

/**
 * 실시간 계좌이체 구독 활성화 — 결제가 PAID로 확정됐을 때만 호출된다(웹훅·결과확인 공용).
 * 멱등: payments.metadata.sub_activated 플래그로 중복 활성화를 막는다.
 * 카드 구독과 달리 billing_key가 없으므로 만기 시 크론이 자동 종료한다.
 */
export async function activateTransferSubscription(
  orderId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: payment } = await admin
      .from("payments")
      .select("id, user_id, status, metadata")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!payment || payment.status !== "PAID") return;

    const meta = (payment.metadata as Record<string, unknown> | null) ?? {};
    if (meta.kind !== "subscription" || meta.method !== "transfer") return;
    if (meta.sub_activated) return; // 이미 활성화됨

    const planId = meta.plan as PlanId;
    if (!PAID_PLANS.includes(planId)) return;
    const userId = payment.user_id as string;

    const { data: sub } = await admin
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", userId)
      .maybeSingle();

    const { error: subErr } = await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        plan: planId,
        status: "active",
        // 기존 기간이 남아 있으면 이어서 +1개월, 없으면 지금부터 1개월
        current_period_end: addOneMonth(sub?.current_period_end ?? null),
        billing_key: null, // 계좌이체는 정기결제가 아님 — 만기 시 크론이 종료
        cancel_at_period_end: false,
        billing_failures: 0,
        trial: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (subErr) {
      console.error("[billing] transfer sub upsert failed AFTER paid", userId, subErr);
      return; // 플래그 미기록 → 웹훅 재시도 시 다시 시도
    }

    // 활성화 완료 표시 (멱등 가드)
    await admin
      .from("payments")
      .update({
        metadata: { ...meta, sub_activated: true, activated_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    // 마케터 수당 + 추천인 전환 보상 (각자 멱등, 실패 무시).
    // 월 UP 지급 정책 폐지로 구독 결제는 포인트를 자동 지급하지 않는다(카드 구독과 동일).
    const plan = getPlanById(planId);
    await accrueSubscriptionCommission({
      paymentId: payment.id as string,
      clientUserId: userId,
      planId,
      amount: plan.priceKrw ?? 0,
    });
    try {
      await markReferralPaidConversion(userId);
    } catch {
      /* 보상 실패는 활성화에 영향 없음 */
    }
  } catch (err) {
    console.error("[billing] activateTransferSubscription error", orderId, err);
  }
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
