import { createAdminClient } from "@/lib/supabase/server";

/** 관리자 회원 관리 조회 — 호출 전 반드시 isCurrentUserAdmin() 확인. */

export interface AdminMember {
  userId: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  /** 구독 플랜 (없으면 "free") */
  plan: string;
  planStatus: string;
  /** 소유한 비즈니스 수 */
  businessCount: number;
  /** 누적 결제 금액 (PAID 합계, 원) */
  paidTotal: number;
  /** 이 회원을 추천한 사람(리퍼럴로 가입한 경우). 없으면 null */
  referredBy: { name: string; email: string } | null;
}

export interface AdminMembersResult {
  members: AdminMember[];
  /** 전체 회원 수 (limit과 무관한 총계) */
  total: number;
}

/** 가입일 최신순 회원 목록 + 플랜·비즈니스 수·누적 결제 집계. */
export async function getMembersAdmin(limit = 300): Promise<AdminMembersResult> {
  const admin = createAdminClient();

  const [{ data: profiles }, { count }] = await Promise.all([
    admin
      .from("profiles")
      .select("user_id,name,email,is_admin,created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    admin.from("profiles").select("user_id", { count: "exact", head: true }),
  ]);

  const list = profiles ?? [];
  if (list.length === 0) return { members: [], total: count ?? 0 };

  const ids = list.map((p) => p.user_id);

  // 구독은 0012 마이그레이션 이후에만 존재 — 없으면 조용히 free로 처리한다.
  const [subsRes, bizRes, payRes, refRes] = await Promise.all([
    admin.from("subscriptions").select("user_id,plan,status").in("user_id", ids),
    admin.from("businesses").select("user_id").in("user_id", ids),
    admin
      .from("payments")
      .select("user_id,amount")
      .in("user_id", ids)
      .eq("status", "PAID"),
    // 이 회원들이 추천으로 가입했는지 — referred_user_id가 곧 이 회원의 id.
    admin
      .from("referrals")
      .select("referred_user_id,referrer_user_id")
      .in("referred_user_id", ids),
  ]);

  const subByUser = new Map(
    (subsRes.data ?? []).map((s) => [s.user_id, s]),
  );

  // 추천인 프로필 조회 — 추천인은 목록(limit) 밖일 수 있어 따로 끌어온다.
  const referrerIdByUser = new Map<string, string>();
  for (const r of refRes.data ?? [])
    referrerIdByUser.set(r.referred_user_id, r.referrer_user_id);
  const referrerProfile = new Map<string, { name: string; email: string }>();
  const referrerIds = [...new Set(referrerIdByUser.values())];
  if (referrerIds.length > 0) {
    const { data: refProfiles } = await admin
      .from("profiles")
      .select("user_id,name,email")
      .in("user_id", referrerIds);
    for (const p of refProfiles ?? [])
      referrerProfile.set(p.user_id, {
        name: p.name ?? "이름 없음",
        email: p.email ?? "",
      });
  }
  const bizCount = new Map<string, number>();
  for (const b of bizRes.data ?? [])
    bizCount.set(b.user_id, (bizCount.get(b.user_id) ?? 0) + 1);
  const paidTotal = new Map<string, number>();
  for (const p of payRes.data ?? [])
    paidTotal.set(p.user_id, (paidTotal.get(p.user_id) ?? 0) + p.amount);

  const members: AdminMember[] = list.map((p) => {
    const sub = subByUser.get(p.user_id);
    const referrerId = referrerIdByUser.get(p.user_id);
    return {
      userId: p.user_id,
      name: p.name ?? "이름 없음",
      email: p.email ?? "",
      isAdmin: p.is_admin,
      createdAt: p.created_at,
      plan: sub?.plan ?? "free",
      planStatus: sub?.status ?? "none",
      businessCount: bizCount.get(p.user_id) ?? 0,
      paidTotal: paidTotal.get(p.user_id) ?? 0,
      referredBy: referrerId
        ? referrerProfile.get(referrerId) ?? { name: "알 수 없음", email: "" }
        : null,
    };
  });

  return { members, total: count ?? members.length };
}
