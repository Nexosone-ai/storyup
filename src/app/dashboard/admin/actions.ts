"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  adminRefundPayment,
  getPointBreakdown,
} from "@/lib/payments/service";
import { PLANS, type PlanId } from "@/lib/plans";
import {
  approveBankTransfer,
  rejectBankTransfer,
} from "@/lib/payments/bankTransfer";
import { markReferralPaidConversion } from "@/lib/gamification/referral";
import {
  SETTING_KEYS,
  invalidateSettingsCache,
} from "@/lib/gamification/config";
import {
  setMarketerByEmail,
  saveMarketerReward,
  generateSettlements,
  markSettlementPaid,
  type Rank,
} from "@/lib/marketers";

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

// ---------------- 계좌이체 결제 승인 ----------------

/** 계좌이체 신청 승인 — 입금 확인 후 구독을 1개월 활성화한다. */
export async function approveBankTransferAction(
  requestId: string,
): Promise<AdminState> {
  const { user, admin } = await requireAdmin();
  if (!admin || !user) return { error: "권한이 없습니다." };
  const res = await approveBankTransfer(requestId, user.id);
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/admin/billing");
  return { ok: true, message: "구독을 활성화했습니다." };
}

/** 계좌이체 신청 거절 — 사유(선택)를 기록한다. */
export async function rejectBankTransferAction(
  requestId: string,
  note: string,
): Promise<AdminState> {
  const { user, admin } = await requireAdmin();
  if (!admin || !user) return { error: "권한이 없습니다." };
  const res = await rejectBankTransfer(requestId, user.id, note ?? "");
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/admin/billing");
  return { ok: true, message: "신청을 거절했습니다." };
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


// ---------------- PG 일반결제 상품 관리 ----------------

export interface AdminProductInput {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  detailImageUrl: string;
  active: boolean;
  sortOrder: number;
  /** 결제 시 자동 지급할 구독 플랜 ("" = 지급 없음, "basic", "pro") */
  grantsPlan: string;
  /** 지급 기간(일) */
  grantDays: number;
}

/** 상품명 → URL slug. ASCII 부분 + 랜덤 접미사(중복 방지). 한글만이면 랜덤. */
function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = randomBytes(3).toString("hex"); // 6자
  return base ? `${base}-${suffix}` : suffix;
}

function validateProduct(input: AdminProductInput): string | null {
  if (!input.name.trim()) return "상품명을 입력해주세요.";
  if (!Number.isInteger(input.price) || input.price <= 0)
    return "가격은 1원 이상으로 입력해주세요.";
  return null;
}

/** 상품 생성 — 저장 즉시 /pay/{slug} 링크가 활성화된다. */
export async function createProductAction(
  input: AdminProductInput,
): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const invalid = validateProduct(input);
  if (invalid) return { error: invalid };

  const adminc = createAdminClient();
  // slug 유니크 충돌 시 재시도
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = makeSlug(input.name);
    const { error } = await adminc.from("products").insert({
      slug,
      name: input.name.trim(),
      description: input.description.trim() || null,
      price: input.price,
      image_url: input.imageUrl.trim() || null,
      detail_image_url: input.detailImageUrl.trim() || null,
      active: input.active,
      sort_order: input.sortOrder,
      grants_plan: input.grantsPlan || null,
      grant_days: input.grantDays > 0 ? input.grantDays : 30,
    });
    if (!error) {
      revalidatePath("/dashboard/admin");
      return { ok: true, message: "상품이 등록되었습니다." };
    }
    if (error.code !== "23505") {
      console.error("[admin] product create failed", error);
      return {
        error:
          "상품 등록에 실패했습니다. (0022 마이그레이션이 적용됐는지 확인해주세요)",
      };
    }
  }
  return { error: "상품 등록에 실패했습니다. 다시 시도해주세요." };
}

/** 상품 수정 — slug(공유 링크)는 유지한다. */
export async function updateProductAction(
  id: string,
  input: AdminProductInput,
): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const invalid = validateProduct(input);
  if (invalid) return { error: invalid };

  const adminc = createAdminClient();
  const { error } = await adminc
    .from("products")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      price: input.price,
      image_url: input.imageUrl.trim() || null,
      detail_image_url: input.detailImageUrl.trim() || null,
      active: input.active,
      sort_order: input.sortOrder,
      grants_plan: input.grantsPlan || null,
      grant_days: input.grantDays > 0 ? input.grantDays : 30,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "상품 저장에 실패했습니다." };
  revalidatePath("/dashboard/admin");
  return { ok: true, message: "상품이 저장되었습니다." };
}

/** 상품 삭제 — 주문 기록은 product_name 스냅샷으로 보존된다(FK set null). */
export async function deleteProductAction(id: string): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const adminc = createAdminClient();
  const { error } = await adminc.from("products").delete().eq("id", id);
  if (error) return { error: "상품 삭제에 실패했습니다." };
  revalidatePath("/dashboard/admin");
  return { ok: true, message: "상품이 삭제되었습니다." };
}

// ---------------- 마케터(리셀러/메이커) 조직 ----------------

/** 유저를 마케터로 지정/해제. */
export async function setMarketerAction(
  email: string,
  enable: boolean,
  payoutType: "freelancer" | "business",
): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const res = await setMarketerByEmail(email, enable, payoutType);
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/admin");
  return {
    ok: true,
    message: enable ? "마케터로 지정했습니다." : "마케터를 해제했습니다.",
  };
}

/** 직급별 상품/플랜 수당 저장. */
export async function saveMarketerRewardAction(
  itemType: "subscription_plan" | "product",
  itemKey: string,
  rank: Rank,
  amount: number,
  active: boolean,
): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const res = await saveMarketerReward({ itemType, itemKey, rank, amount, active });
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/admin");
  return { ok: true, message: "수당이 저장되었습니다." };
}

/** 월별 정산 생성 (해당 월 미정산 수당 마감). */
export async function generateSettlementsAction(
  period: string,
): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const res = await generateSettlements(period);
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/admin");
  return {
    ok: true,
    message: `${period} 정산 ${res.created ?? 0}건을 생성했습니다.`,
  };
}

/** 정산 배치 지급완료 처리. */
export async function markSettlementPaidAction(
  settlementId: string,
): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const res = await markSettlementPaid(settlementId);
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/admin");
  return { ok: true, message: "지급완료로 처리했습니다." };
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
  streak?: number;
  achievements?: number;
  referrals?: number;
  recentRewards?: { rule: string; up: number; created_at: string }[];
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

  const [breakdown, streakRow, achCount, refCount, recent] =
    await Promise.all([
      getPointBreakdown(profile.user_id),
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
        .select("rule,up,created_at")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return {
    name: profile.name ?? "이름 없음",
    email: profile.email ?? email,
    balance: breakdown.balance,
    streak: streakRow.data?.current ?? 0,
    achievements: achCount.count ?? 0,
    referrals: refCount.count ?? 0,
    recentRewards: recent.data ?? [],
  };
}
