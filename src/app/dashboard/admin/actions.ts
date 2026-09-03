"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  adminRefundPayment,
  getPointBreakdown,
} from "@/lib/payments/service";
import { PLANS, type PlanId } from "@/lib/plans";

export interface AdminState {
  error?: string;
  ok?: boolean;
  message?: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, admin: !!data?.is_admin };
}

export async function grantPoints(
  email: string,
  amount: number,
  reason: string,
): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  if (!Number.isInteger(amount) || amount === 0)
    return { error: "지급/차감할 포인트를 입력해주세요." };

  const adminc = createAdminClient();
  const { data: profile } = await adminc
    .from("profiles")
    .select("user_id,name")
    .eq("email", email.trim())
    .maybeSingle();
  if (!profile) return { error: "해당 이메일의 사용자를 찾을 수 없습니다." };

  if (!reason.trim()) return { error: "지급/차감 사유를 입력해주세요." };

  const { error } = await adminc.from("point_transactions").insert({
    user_id: profile.user_id,
    amount,
    reason: reason.trim(),
    type: amount > 0 ? "ADMIN_CREDIT" : "ADMIN_DEBIT",
    ref_type: "admin_grant",
  });
  if (error) return { error: "지급에 실패했습니다." };
  revalidatePath("/dashboard/admin");
  return { ok: true, message: `${profile.name ?? email}님에게 ${amount}P 반영되었습니다.` };
}

/** 관리자 환불 — 미사용 크레딧 범위의 전액 환불만 허용 (감사 기록 필수). */
export async function refundPaymentAction(
  paymentId: string,
  reason: string,
): Promise<AdminState> {
  const { user, admin } = await requireAdmin();
  if (!admin || !user) return { error: "권한이 없습니다." };
  if (!reason.trim()) return { error: "환불 사유를 입력해주세요." };

  const result = await adminRefundPayment(
    paymentId,
    `관리자 환불(${user.email ?? user.id}): ${reason.trim()}`,
  );
  if (result.error) return { error: result.error };
  revalidatePath("/dashboard/admin");
  return { ok: true, message: "환불이 처리되었습니다." };
}

export interface UserPointLookup {
  error?: string;
  name?: string;
  email?: string;
  balance?: number;
  purchasedRemaining?: number;
  recent?: { reason: string; amount: number; created_at: string }[];
}

/** 사용자 플랜 지정 — 정기결제 도입 전까지 관리자가 수동으로 부여한다. */
export async function setUserPlanAction(
  email: string,
  plan: string,
): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  if (!PLANS.some((p) => p.id === plan))
    return { error: "올바르지 않은 플랜입니다." };

  const adminc = createAdminClient();
  const { data: profile } = await adminc
    .from("profiles")
    .select("user_id,name")
    .eq("email", email.trim())
    .maybeSingle();
  if (!profile) return { error: "해당 이메일의 사용자를 찾을 수 없습니다." };

  const { error } = await adminc.from("subscriptions").upsert(
    {
      user_id: profile.user_id,
      plan: plan as PlanId,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error)
    return {
      error:
        "플랜 저장에 실패했습니다. (0012 마이그레이션이 적용됐는지 확인해주세요)",
    };
  revalidatePath("/dashboard/admin");
  return {
    ok: true,
    message: `${profile.name ?? email}님의 플랜을 ${plan.toUpperCase()}(으)로 변경했습니다.`,
  };
}

/** 사용자 검색 → 잔액·구매잔여·최근 거래. */
export async function lookupUserPointsAction(
  email: string,
): Promise<UserPointLookup> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };

  const adminc = createAdminClient();
  const { data: profile } = await adminc
    .from("profiles")
    .select("user_id,name,email")
    .eq("email", email.trim())
    .maybeSingle();
  if (!profile) return { error: "해당 이메일의 사용자를 찾을 수 없습니다." };

  const breakdown = await getPointBreakdown(profile.user_id);
  const { data: recent } = await adminc
    .from("point_transactions")
    .select("reason,amount,created_at")
    .eq("user_id", profile.user_id)
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    name: profile.name ?? "이름 없음",
    email: profile.email ?? email,
    balance: breakdown.balance,
    purchasedRemaining: breakdown.purchasedRemaining,
    recent: recent ?? [],
  };
}

/** 충전 패키지 저장 (신규/수정). 가격·크레딧은 항상 서버 DB가 권위. */
export async function savePackageAction(pkg: {
  id?: string;
  name: string;
  price_krw: number;
  credits: number;
  bonus_credits: number;
  active: boolean;
  sort_order: number;
}): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  if (!pkg.name.trim()) return { error: "패키지 이름을 입력해주세요." };
  if (!Number.isInteger(pkg.price_krw) || pkg.price_krw <= 0)
    return { error: "결제 금액이 올바르지 않습니다." };
  if (!Number.isInteger(pkg.credits) || pkg.credits <= 0)
    return { error: "크레딧 수량이 올바르지 않습니다." };
  if (!Number.isInteger(pkg.bonus_credits) || pkg.bonus_credits < 0)
    return { error: "보너스 크레딧이 올바르지 않습니다." };

  const adminc = createAdminClient();
  const row = {
    name: pkg.name.trim(),
    price_krw: pkg.price_krw,
    credits: pkg.credits,
    bonus_credits: pkg.bonus_credits,
    active: pkg.active,
    sort_order: pkg.sort_order,
    updated_at: new Date().toISOString(),
  };
  const { error } = pkg.id
    ? await adminc.from("point_packages").update(row).eq("id", pkg.id)
    : await adminc.from("point_packages").insert(row);
  if (error) return { error: "저장에 실패했습니다." };
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/points");
  return { ok: true, message: "패키지가 저장되었습니다." };
}

/** AI 서비스 가격 저장. 0원 = 무료. */
export async function saveServicePriceAction(
  service: string,
  price: number,
  active: boolean,
): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  if (!Number.isInteger(price) || price < 0)
    return { error: "가격이 올바르지 않습니다." };

  const adminc = createAdminClient();
  const { error } = await adminc
    .from("service_prices")
    .update({ price, active, updated_at: new Date().toISOString() })
    .eq("service", service);
  if (error) return { error: "저장에 실패했습니다." };
  revalidatePath("/dashboard/admin");
  return { ok: true, message: "가격이 저장되었습니다." };
}

