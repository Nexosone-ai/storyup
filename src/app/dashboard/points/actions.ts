"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  startSubscription,
  cancelAtPeriodEnd,
  resumeSubscription,
  createTransferSubscriptionOrder,
  type TransferOrder,
} from "@/lib/payments/billing";
import { createBankTransferRequest } from "@/lib/payments/bankTransfer";
import { syncPayment } from "@/lib/payments/service";
import type { PlanId } from "@/lib/plans";

interface ActionResult {
  ok?: boolean;
  error?: string;
  message?: string;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** 빌링키 발급 직후 호출 — 첫 결제 + 구독 시작. 금액은 서버가 결정한다. */
export async function startSubscriptionAction(
  planId: string,
  billingKey: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (planId !== "basic" && planId !== "pro")
    return { error: "구독할 수 없는 플랜입니다." };
  if (!billingKey || typeof billingKey !== "string" || billingKey.length > 200)
    return { error: "카드 등록 정보가 올바르지 않습니다." };

  const res = await startSubscription(user.id, planId as PlanId, billingKey);
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/points");
  return { ok: true, message: "구독이 시작되었습니다." };
}

/** 계좌이체 결제 신청 — 관리자가 입금 확인 후 활성화한다. 금액은 서버가 결정. */
export async function requestBankTransferAction(
  planId: string,
  depositorName: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (planId !== "basic" && planId !== "pro")
    return { error: "구독할 수 없는 플랜입니다." };
  if (!depositorName || typeof depositorName !== "string" || depositorName.length > 60)
    return { error: "입금자명을 정확히 입력해주세요." };

  const res = await createBankTransferRequest(
    user.id,
    planId as PlanId,
    depositorName,
  );
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/points");
  revalidatePath("/dashboard/plans");
  return {
    ok: true,
    message: "신청이 접수되었습니다. 입금 확인 후 관리자가 활성화해 드립니다.",
  };
}

/**
 * 실시간 계좌이체 구독 주문 시작 — PENDING 주문을 만들고 결제창 파라미터를 돌려준다.
 * 금액은 서버가 결정하며, 활성화는 결제 확정(PAID) 후 confirm/웹훅이 처리한다.
 */
export async function startTransferSubscriptionAction(
  planId: string,
): Promise<ActionResult & { order?: TransferOrder }> {
  const user = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (planId !== "basic" && planId !== "pro")
    return { error: "구독할 수 없는 플랜입니다." };

  const res = await createTransferSubscriptionOrder(user.id, planId as PlanId);
  if (res.error || !res.order) return { error: res.error ?? "주문 생성에 실패했습니다." };
  return { ok: true, order: res.order };
}

/**
 * 실시간 계좌이체 구독 결제 확정 — 결제창 종료(팝업) 또는 리다이렉트 복귀 시 호출.
 * PortOne API로 재검증(syncPayment)하고, PAID면 구독을 활성화한다. 멱등.
 */
export async function confirmTransferSubscriptionAction(
  orderId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!orderId || typeof orderId !== "string" || !orderId.startsWith("sub_"))
    return { error: "주문 정보가 올바르지 않습니다." };

  const res = await syncPayment(orderId);
  revalidatePath("/dashboard/points");
  revalidatePath("/dashboard/plans");
  if (res.status === "PAID")
    return { ok: true, message: "결제가 확인되어 구독이 시작되었습니다." };
  if (res.error) return { error: res.error };
  // READY / PAY_PENDING 등 — 아직 확정 전
  return {
    ok: true,
    message: "결제 확인 중입니다. 입금이 완료되면 자동으로 활성화됩니다.",
  };
}

/** 해지 예약 — 남은 기간은 그대로 이용 가능. */
export async function cancelSubscriptionAction(): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const res = await cancelAtPeriodEnd(user.id);
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/points");
  return {
    ok: true,
    message: "해지가 예약되었습니다. 남은 기간까지는 그대로 이용할 수 있어요.",
  };
}

/** 해지 예약 취소. */
export async function resumeSubscriptionAction(): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const res = await resumeSubscription(user.id);
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/points");
  return { ok: true, message: "구독이 계속 유지됩니다." };
}
