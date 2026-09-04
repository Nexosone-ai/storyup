"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  adminRefundPayment,
  getPointBreakdown,
} from "@/lib/payments/service";
import { PLANS, type PlanId } from "@/lib/plans";
import { markReferralPaidConversion } from "@/lib/gamification/referral";
import {
  SETTING_KEYS,
  invalidateSettingsCache,
} from "@/lib/gamification/config";

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

  // 추천받은 사용자의 유료 전환 — 추천인에게 1회 보상 (free 제외)
  if (plan !== "free") await markReferralPaidConversion(profile.user_id);

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


// ---------------- 게이미피케이션 (UP/XP/미션/보상 정책) ----------------

const GROWTH_SETTING_KEYS = new Set<string>(Object.values(SETTING_KEYS));

/** 보상 정책 저장 — key별 JSON. 저장 즉시 엔진 캐시를 무효화한다. */
export async function saveRewardSettingAction(
  key: string,
  json: string,
): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  if (!GROWTH_SETTING_KEYS.has(key))
    return { error: "알 수 없는 설정 키입니다." };

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { error: "JSON 형식이 올바르지 않습니다." };
  }

  const adminc = createAdminClient();
  const { error } = await adminc.from("reward_settings").upsert({
    key,
    value: value as never,
    updated_at: new Date().toISOString(),
  });
  if (error)
    return {
      error: "저장에 실패했습니다. (0016 마이그레이션이 적용됐는지 확인해주세요)",
    };
  invalidateSettingsCache();
  revalidatePath("/dashboard/admin");
  return { ok: true, message: `${key} 설정이 저장되었습니다.` };
}

/** 보상 정책 초기화 — DB 오버라이드를 지우고 코드 기본값으로 되돌린다. */
export async function resetRewardSettingAction(key: string): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  if (!GROWTH_SETTING_KEYS.has(key))
    return { error: "알 수 없는 설정 키입니다." };
  const adminc = createAdminClient();
  await adminc.from("reward_settings").delete().eq("key", key);
  invalidateSettingsCache();
  revalidatePath("/dashboard/admin");
  return { ok: true, message: `${key} 설정을 기본값으로 되돌렸습니다.` };
}

export interface UserGrowthLookup {
  error?: string;
  name?: string;
  email?: string;
  balance?: number;
  xp?: number;
  streak?: number;
  achievements?: number;
  referrals?: number;
  recentRewards?: { rule: string; up: number; xp: number; created_at: string }[];
}

/** 사용자 성장 상태 조회 (UP·XP·스트릭·업적·추천). */
export async function lookupUserGrowthAction(
  email: string,
): Promise<UserGrowthLookup> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };

  const adminc = createAdminClient();
  const { data: profile } = await adminc
    .from("profiles")
    .select("user_id,name,email")
    .eq("email", email.trim())
    .maybeSingle();
  if (!profile) return { error: "해당 이메일의 사용자를 찾을 수 없습니다." };

  const [breakdown, xpRow, streakRow, achCount, refCount, recent] =
    await Promise.all([
      getPointBreakdown(profile.user_id),
      adminc.from("user_xp").select("xp").eq("user_id", profile.user_id).maybeSingle(),
      adminc
        .from("user_streaks")
        .select("current")
        .eq("user_id", profile.user_id)
        .maybeSingle(),
      adminc
        .from("user_achievements")
        .select("code", { count: "exact", head: true })
        .eq("user_id", profile.user_id),
      adminc
        .from("referrals")
        .select("referred_user_id", { count: "exact", head: true })
        .eq("referrer_user_id", profile.user_id),
      adminc
        .from("reward_events")
        .select("rule,up,xp,created_at")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return {
    name: profile.name ?? "이름 없음",
    email: profile.email ?? email,
    balance: breakdown.balance,
    xp: xpRow.data?.xp ?? 0,
    streak: streakRow.data?.current ?? 0,
    achievements: achCount.count ?? 0,
    referrals: refCount.count ?? 0,
    recentRewards: recent.data ?? [],
  };
}
