"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  startSubscription,
  cancelAtPeriodEnd,
  resumeSubscription,
} from "@/lib/payments/billing";
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
