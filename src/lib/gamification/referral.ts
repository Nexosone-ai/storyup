import { createAdminClient } from "@/lib/supabase/server";
import { award } from "./engine";
import { checkReferralAchievements } from "./achievements";

/**
 * 추천인 시스템 — 직접 추천만 (다단계 없음).
 * - 코드: profiles.referral_code (유니크)
 * - 귀속: referrals PK(referred_user_id) → 1인 1추천인, 자기추천은 DB check로 차단
 * - 악용 방지: 가입 후 3일 이내에만 귀속, 보상 멱등키는 referred ID 기반
 */

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 헷갈리는 문자 제외

function genCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++)
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

/** 내 추천 코드 — 없으면 생성해서 저장. 실패 시 null. */
export async function ensureReferralCode(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("referral_code")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return null; // 컬럼 없음(마이그레이션 전)
    if (profile?.referral_code) return profile.referral_code;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = genCode();
      const { error: upErr } = await admin
        .from("profiles")
        .update({ referral_code: code })
        .eq("user_id", userId)
        .is("referral_code", null);
      if (!upErr) return code; // 유니크 충돌이면 upErr — 재시도
    }
    return null;
  } catch {
    return null;
  }
}

/** 가입 보너스 + 추천 코드 준비 + (쿠키의) 추천 귀속. 멱등 — 매 대시보드 로드마다 호출해도 안전. */
export async function ensureUserSetup(
  userId: string,
  pendingRefCode?: string | null,
): Promise<void> {
  await award(userId, "signup", "signup");
  await ensureReferralCode(userId);
  if (pendingRefCode) await attributeReferral(userId, pendingRefCode);
}

/** ?ref= 코드로 가입한 사용자를 추천인에게 귀속하고 추천인에게 보상한다. */
export async function attributeReferral(
  referredUserId: string,
  code: string,
): Promise<boolean> {
  try {
    const cleaned = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(cleaned)) return false;
    const admin = createAdminClient();

    // 이미 귀속돼 있으면 종료
    const { data: existing, error: exErr } = await admin
      .from("referrals")
      .select("referred_user_id")
      .eq("referred_user_id", referredUserId)
      .maybeSingle();
    if (exErr || existing) return false;

    const { data: refProfile } = await admin
      .from("profiles")
      .select("user_id")
      .eq("referral_code", cleaned)
      .maybeSingle();
    if (!refProfile || refProfile.user_id === referredUserId) return false;

    // 신규 가입자만 귀속 (가입 3일 이내) — 기존 계정 재귀속 방지
    const { data: authUser } = await admin.auth.admin.getUserById(referredUserId);
    const createdAt = authUser?.user?.created_at;
    if (!createdAt || Date.now() - new Date(createdAt).getTime() > 3 * 86_400_000)
      return false;

    const { error: insErr } = await admin.from("referrals").insert({
      referred_user_id: referredUserId,
      referrer_user_id: refProfile.user_id,
      code: cleaned,
    });
    if (insErr) return false; // 경합 등

    // 추천인 보상 (멱등키: 가입자 ID)
    await award(
      refProfile.user_id,
      "ref_signup",
      `ref_signup:${referredUserId}`,
    );

    const { count } = await admin
      .from("referrals")
      .select("referred_user_id", { count: "exact", head: true })
      .eq("referrer_user_id", refProfile.user_id);
    await checkReferralAchievements(refProfile.user_id, count ?? 0);
    return true;
  } catch {
    return false;
  }
}

/** 추천받은 사용자가 유료 플랜으로 전환됐을 때 — 추천인에게 1회 보상. */
export async function markReferralPaidConversion(
  referredUserId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("referrals")
      .select("referrer_user_id, paid_rewarded")
      .eq("referred_user_id", referredUserId)
      .maybeSingle();
    if (!row || row.paid_rewarded) return;
    const res = await award(
      row.referrer_user_id,
      "ref_paid",
      `ref_paid:${referredUserId}`,
    );
    if (res.granted)
      await admin
        .from("referrals")
        .update({ paid_rewarded: true })
        .eq("referred_user_id", referredUserId);
  } catch {
    /* 무시 */
  }
}

export interface ReferralStats {
  code: string | null;
  invitedCount: number;
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await ensureReferralCode(userId);
  try {
    const admin = createAdminClient();
    const { count } = await admin
      .from("referrals")
      .select("referred_user_id", { count: "exact", head: true })
      .eq("referrer_user_id", userId);
    return { code, invitedCount: count ?? 0 };
  } catch {
    return { code, invitedCount: 0 };
  }
}
