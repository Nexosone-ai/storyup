"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import {
  createChargeOrder,
  syncPayment,
  getPointBreakdown,
} from "@/lib/payments/service";

export interface PointState {
  error?: string;
  ok?: boolean;
}

export async function requestWithdrawal(
  amount: number,
  accountInfo: string,
): Promise<PointState> {
  const ko = (await getLocale()) === "ko";
  if (!Number.isInteger(amount) || amount <= 0)
    return {
      error: ko
        ? "출금할 포인트를 올바르게 입력해주세요."
        : "Please enter a valid amount of points to withdraw.",
    };
  if (!accountInfo.trim())
    return {
      error: ko
        ? "정산 계좌 정보를 입력해주세요."
        : "Please enter your payout account details.",
    };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // closed-loop 규칙: 충전 크레딧은 출금 불가 — 수익 포인트 한도까지만.
  const { withdrawable } = await getPointBreakdown(user.id);
  if (amount > withdrawable)
    return {
      error: ko
        ? `출금 가능 포인트(수익)는 ${withdrawable.toLocaleString()}P입니다. 충전 크레딧은 출금할 수 없습니다.`
        : `Your withdrawable (earned) points are ${withdrawable.toLocaleString()}P. Purchased credits cannot be withdrawn.`,
    };

  const { error } = await supabase.from("withdrawal_requests").insert({
    user_id: user.id,
    amount,
    account_info: accountInfo.trim(),
  });
  if (error)
    return { error: ko ? "요청에 실패했습니다." : "Request failed." };
  revalidatePath("/dashboard/points");
  return { ok: true };
}

// ---------------- 크레딧 충전 ----------------

export interface ChargeOrderResult {
  error?: string;
  orderId?: string;
  orderName?: string;
  amount?: number;
  storeId?: string;
  channelKey?: string;
  customerEmail?: string;
}

/** 서버가 권위 있는 가격으로 내부 주문을 생성한다. */
export async function createChargeOrderAction(
  packageId: string,
): Promise<ChargeOrderResult> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  if (!storeId || !channelKey)
    return {
      error: ko
        ? "결제 설정이 아직 완료되지 않았습니다. 잠시 후 다시 시도해주세요."
        : "Payments are not set up yet. Please try again shortly.",
    };

  try {
    const order = await createChargeOrder(user.id, packageId);
    return {
      ...order,
      storeId,
      channelKey,
      customerEmail: user.email ?? undefined,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : ko
            ? "주문 생성에 실패했습니다."
            : "Failed to create the order.",
    };
  }
}

export interface ConfirmChargeResult {
  error?: string;
  ok?: boolean;
  status?: string;
  credited?: number;
  balance?: number;
}

/** 결제 완료 후 서버 측 검증 + 멱등 적립. 프론트 성공 콜백은 신뢰하지 않는다. */
export async function confirmChargeAction(
  orderId: string,
): Promise<ConfirmChargeResult> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // 주문 소유권 검증
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, user_id, credits, bonus_credits")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!payment || payment.user_id !== user.id)
    return { error: ko ? "주문을 찾을 수 없습니다." : "Order not found." };

  const result = await syncPayment(orderId);
  revalidatePath("/dashboard/points");

  if (result.status === "PAID") {
    return {
      ok: true,
      status: result.status,
      credited: payment.credits + payment.bonus_credits,
      balance: result.balance,
    };
  }
  return {
    error:
      result.error ??
      (ko ? "결제가 완료되지 않았습니다." : "The payment was not completed."),
    status: result.status,
  };
}

/** 사용자가 결제창을 닫거나 결제가 실패했을 때 주문을 정리한다. */
export async function markChargeFailedAction(
  orderId: string,
  reason: string,
): Promise<PointState> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const admin = createAdminClient();
  await admin
    .from("payments")
    .update({
      status: "FAILED",
      updated_at: new Date().toISOString(),
      metadata: { fail_reason: reason.slice(0, 300) },
    })
    .eq("order_id", orderId)
    .eq("user_id", user.id)
    .eq("status", "PENDING");
  revalidatePath("/dashboard/points");
  return { ok: true };
}
