import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getPortonePayment,
  cancelPortonePayment,
  PaymentProviderError,
} from "@/lib/payments/portone";
import type { PaymentRow } from "@/types/database";

/**
 * 결제 서비스 핵심 규칙:
 * - 가격/적립량은 항상 서버(DB 패키지)가 결정한다. 브라우저 값은 절대 신뢰하지 않는다.
 * - 포인트 적립은 PortOne API로 결제를 재검증한 뒤에만, 원장 유니크 제약으로 1회만.
 * - 모든 상태 변화는 payments + point_transactions에 감사 기록을 남긴다.
 */

export interface ChargeOrder {
  orderId: string;
  orderName: string;
  amount: number;
  currency: "KRW";
}

/** 내부 주문 생성 — 서버가 권위 있는 가격을 확정한다. */
export async function createChargeOrder(
  userId: string,
  packageId: string,
): Promise<ChargeOrder> {
  const admin = createAdminClient();
  const { data: pkg } = await admin
    .from("point_packages")
    .select("*")
    .eq("id", packageId)
    .eq("active", true)
    .maybeSingle();
  if (!pkg) throw new Error("판매 중인 패키지가 아닙니다.");

  const orderId = `su_${randomUUID()}`;
  const orderName = `STORYUP 크레딧 — ${pkg.name} (${(
    pkg.credits + pkg.bonus_credits
  ).toLocaleString()}P)`;

  const { error } = await admin.from("payments").insert({
    user_id: userId,
    order_id: orderId,
    package_id: pkg.id,
    provider: "portone",
    currency: "KRW",
    amount: pkg.price_krw,
    credits: pkg.credits,
    bonus_credits: pkg.bonus_credits,
    status: "PENDING",
    metadata: { package_name: pkg.name },
  });
  if (error) throw new Error("주문 생성에 실패했습니다.");

  return { orderId, orderName, amount: pkg.price_krw, currency: "KRW" };
}

export interface SyncResult {
  status: PaymentRow["status"];
  credited: number;
  balance?: number;
  error?: string;
}

/**
 * 결제 상태 동기화 + 포인트 적립 (멱등).
 * confirm API와 웹훅이 모두 이 함수를 사용한다 — 몇 번을 다시 호출해도
 * 적립은 원장 유니크 인덱스((ref_id,type) where ref_type='payment') 덕에 1회만 된다.
 */
export async function syncPayment(orderId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!payment) return { status: "FAILED", credited: 0, error: "주문을 찾을 수 없습니다." };

  let remote;
  try {
    remote = await getPortonePayment(orderId);
  } catch (err) {
    console.error("[payments] provider lookup failed", orderId, err);
    return {
      status: payment.status,
      credited: 0,
      error: "결제 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  const now = new Date().toISOString();

  if (remote.status === "PAID") {
    // 서버 측 검증: 금액·통화·주문 일치
    const paidTotal = remote.amount?.total;
    if (paidTotal !== payment.amount || (remote.currency ?? "KRW") !== payment.currency) {
      await admin
        .from("payments")
        .update({
          status: "FAILED",
          updated_at: now,
          metadata: {
            ...(payment.metadata as object | null),
            verification_error: "AMOUNT_MISMATCH",
            remote_amount: paidTotal ?? null,
            remote_currency: remote.currency ?? null,
          },
        })
        .eq("id", payment.id)
        .eq("status", "PENDING");
      console.error(
        "[payments] amount mismatch",
        orderId,
        payment.amount,
        paidTotal,
      );
      return { status: "FAILED", credited: 0, error: "결제 금액 검증에 실패했습니다." };
    }

    await admin
      .from("payments")
      .update({
        status: "PAID",
        approved_at: now,
        updated_at: now,
        payment_key: remote.id,
        transaction_id: remote.transactionId ?? null,
        payment_method: remote.method?.type ?? "CARD",
      })
      .eq("id", payment.id)
      .in("status", ["PENDING", "FAILED"]);

    // 멱등 적립: 이미 있으면 duplicate key → 무시
    const credited = await creditOnce(payment);
    const balance = await getBalanceAdmin(payment.user_id);
    return { status: "PAID", credited, balance };
  }

  if (remote.status === "CANCELLED" || remote.status === "PARTIAL_CANCELLED") {
    const full = remote.status === "CANCELLED";
    await admin
      .from("payments")
      .update({
        status: full ? "CANCELLED" : "PARTIALLY_CANCELLED",
        cancelled_at: now,
        updated_at: now,
      })
      .eq("id", payment.id);
    if (full && payment.status === "PAID") {
      // 적립됐던 크레딧 회수 (멱등: REFUND도 결제당 1회)
      await debitRefundOnce(payment);
    }
    return { status: full ? "CANCELLED" : "PARTIALLY_CANCELLED", credited: 0 };
  }

  if (remote.status === "FAILED") {
    await admin
      .from("payments")
      .update({ status: "FAILED", updated_at: now })
      .eq("id", payment.id)
      .eq("status", "PENDING");
    return { status: "FAILED", credited: 0, error: "결제가 실패했습니다." };
  }

  // READY / PAY_PENDING 등 — 아직 결과 아님
  return { status: payment.status, credited: 0, error: "결제가 아직 완료되지 않았습니다." };
}

/** 결제 1건에 대한 PURCHASE(+BONUS) 적립. 유니크 인덱스로 중복 차단. */
async function creditOnce(payment: PaymentRow): Promise<number> {
  const admin = createAdminClient();
  let credited = 0;

  const { error: e1 } = await admin.from("point_transactions").insert({
    user_id: payment.user_id,
    amount: payment.credits,
    reason: "크레딧 충전 (카드 결제)",
    type: "PURCHASE",
    ref_type: "payment",
    ref_id: payment.id,
  });
  if (!e1) credited += payment.credits;
  else if (e1.code !== "23505")
    console.error("[payments] credit insert failed", payment.order_id, e1);

  if (payment.bonus_credits > 0) {
    const { error: e2 } = await admin.from("point_transactions").insert({
      user_id: payment.user_id,
      amount: payment.bonus_credits,
      reason: "충전 보너스 크레딧",
      type: "BONUS",
      ref_type: "payment",
      ref_id: payment.id,
    });
    if (!e2) credited += payment.bonus_credits;
    else if (e2.code !== "23505")
      console.error("[payments] bonus insert failed", payment.order_id, e2);
  }
  return credited;
}

/** 전액 취소 시 크레딧 회수 (결제당 1회). */
async function debitRefundOnce(payment: PaymentRow): Promise<void> {
  const admin = createAdminClient();
  const total = payment.credits + payment.bonus_credits;
  const { error } = await admin.from("point_transactions").insert({
    user_id: payment.user_id,
    amount: -total,
    reason: "결제 취소 — 크레딧 회수",
    type: "REFUND",
    ref_type: "payment",
    ref_id: payment.id,
  });
  if (error && error.code !== "23505")
    console.error("[payments] refund debit failed", payment.order_id, error);
}

export async function getBalanceAdmin(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("point_transactions")
    .select("amount")
    .eq("user_id", userId);
  return (data ?? []).reduce((s, t) => s + t.amount, 0);
}

/**
 * 관리자 환불: 미사용 크레딧 범위에서만 전액 환불을 허용한다.
 * (부분 사용된 결제의 안전하지 않은 환불은 차단 — 정책 확정 후 확장)
 */
export async function adminRefundPayment(
  paymentId: string,
  reason: string,
): Promise<{ ok?: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { error: "결제를 찾을 수 없습니다." };
  if (payment.status !== "PAID")
    return { error: "PAID 상태의 결제만 환불할 수 있습니다." };

  const refundTotal = payment.credits + payment.bonus_credits;
  const { purchasedRemaining } = await getPointBreakdown(payment.user_id);
  if (purchasedRemaining < refundTotal)
    return {
      error: `이미 사용된 크레딧이 있어 전액 환불할 수 없습니다. (환불 가능 잔여: ${purchasedRemaining.toLocaleString()}P)`,
    };

  try {
    await cancelPortonePayment(payment.order_id, reason || "관리자 환불");
  } catch (err) {
    const msg =
      err instanceof PaymentProviderError ? err.message : "PG 취소 요청 실패";
    return { error: msg };
  }
  // 상태·원장 동기화는 공용 경로로
  await syncPayment(payment.order_id);
  return { ok: true };
}

export interface PointBreakdown {
  balance: number;
  purchased: number; // PURCHASE + BONUS 누적
  used: number; // AI_USAGE 누적
  refunded: number; // REFUND 회수 누적
  purchasedRemaining: number; // 환불 가능 = 미사용 구매 크레딧
}

/** 구매/수익 크레딧 분해 — closed-loop 규칙과 환불 가능액 판단의 근거. */
export async function getPointBreakdown(
  userId: string,
): Promise<PointBreakdown> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("point_transactions")
    .select("amount, type")
    .eq("user_id", userId);
  const rows = data ?? [];
  const sum = (pred: (t: { amount: number; type: string | null }) => boolean) =>
    rows.filter(pred).reduce((s, t) => s + t.amount, 0);

  const balance = rows.reduce((s, t) => s + t.amount, 0);
  const purchased = sum((t) => t.type === "PURCHASE" || t.type === "BONUS");
  const used = -sum((t) => t.type === "AI_USAGE");
  const refunded = -sum((t) => t.type === "REFUND");
  const purchasedRemaining = Math.max(0, purchased - used - refunded);
  return { balance, purchased, used, refunded, purchasedRemaining };
}
