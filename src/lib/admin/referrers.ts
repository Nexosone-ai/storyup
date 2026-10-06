import { createAdminClient } from "@/lib/supabase/server";

/**
 * 관리자 추천인별 가입·전환 통계 — 호출 전 반드시 관리자 가드(레이아웃)를 거친다.
 * 전 기간 집계는 DB 함수 admin_referrer_stats()로 계산한다(1,000행 상한 회피).
 * 가입 = 추천으로 성사된 가입 수, 전환 = 그 중 유료 전환(paid_rewarded) 수.
 */

export interface ReferrerStat {
  referrerUserId: string;
  name: string;
  email: string;
  /** 데려온 가입 수 */
  signups: number;
  /** 그 중 유료 전환 수 */
  conversions: number;
  /** 전환율 (0~1) */
  conversionRate: number;
}

export interface ReferrerStats {
  rows: ReferrerStat[];
  /** 추천인 수 (한 명 이상 데려온 사람) */
  referrerCount: number;
  /** 추천으로 성사된 총 가입 수 */
  totalSignups: number;
  /** 총 유료 전환 수 */
  totalConversions: number;
}

export async function getReferrerStatsAdmin(): Promise<ReferrerStats> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("admin_referrer_stats");

  const rows: ReferrerStat[] = (data ?? []).map((r) => {
    const signups = Number(r.signups) || 0;
    const conversions = Number(r.conversions) || 0;
    return {
      referrerUserId: r.referrer_user_id,
      name: r.referrer_name ?? "이름 없음",
      email: r.referrer_email ?? "",
      signups,
      conversions,
      conversionRate: signups > 0 ? conversions / signups : 0,
    };
  });

  return {
    rows,
    referrerCount: rows.length,
    totalSignups: rows.reduce((s, r) => s + r.signups, 0),
    totalConversions: rows.reduce((s, r) => s + r.conversions, 0),
  };
}
