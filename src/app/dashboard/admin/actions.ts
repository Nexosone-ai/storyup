"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/points";
import {
  adminRefundPayment,
  getPointBreakdown,
} from "@/lib/payments/service";

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
  withdrawable?: number;
  recent?: { reason: string; amount: number; created_at: string }[];
}

/** 사용자 검색 → 잔액·구매잔여·출금가능·최근 거래. */
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
    withdrawable: breakdown.withdrawable,
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

export async function decideWithdrawal(
  id: string,
  approve: boolean,
): Promise<AdminState> {
  const { user, admin } = await requireAdmin();
  if (!admin || !user) return { error: "권한이 없습니다." };

  const adminc = createAdminClient();
  const { data: req } = await adminc
    .from("withdrawal_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!req || req.status !== "pending")
    return { error: "이미 처리되었거나 존재하지 않는 요청입니다." };

  if (approve) {
    const balance = await getBalance(req.user_id);
    if (req.amount > balance)
      return { error: "사용자의 보유 포인트가 부족합니다." };
    await adminc.from("point_transactions").insert({
      user_id: req.user_id,
      amount: -req.amount,
      reason: "포인트 출금",
      ref_type: "withdrawal",
      ref_id: id,
    });
  }

  await adminc
    .from("withdrawal_requests")
    .update({
      status: approve ? "approved" : "rejected",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/dashboard/admin");
  return { ok: true };
}
