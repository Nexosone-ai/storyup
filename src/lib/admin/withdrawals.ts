import { createAdminClient } from "@/lib/supabase/server";

/**
 * 관리자 회원탈퇴 조회 — 호출 전 반드시 관리자 가드(레이아웃)를 거친다.
 * account_deletions는 탈퇴 대장이다(0046). RLS로 service_role만 접근 가능하므로
 * 반드시 createAdminClient()로 읽는다. 탈퇴 사유·시점·결제이력 여부가 들어 있다.
 */

export interface AdminWithdrawal {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  reason: string | null;
  hadPayments: boolean;
  deletedAt: string;
}

export interface AdminWithdrawals {
  /** 최근 탈퇴 (limit 적용) */
  rows: AdminWithdrawal[];
  /** 전체 탈퇴 수 (limit과 무관) */
  totalCount: number;
  /** 사유를 남긴 탈퇴 수 (전 기간) */
  withReasonCount: number;
}

/** 최근 탈퇴 목록 + 전 기간 집계. */
export async function getWithdrawalsAdmin(
  limit = 200,
): Promise<AdminWithdrawals> {
  const admin = createAdminClient();

  const [rowsRes, { count: totalCount }, { count: withReasonCount }] =
    await Promise.all([
      admin
        .from("account_deletions")
        .select("id,user_id,email,name,reason,had_payments,deleted_at")
        .order("deleted_at", { ascending: false })
        .limit(limit),
      admin
        .from("account_deletions")
        .select("id", { count: "exact", head: true }),
      admin
        .from("account_deletions")
        .select("id", { count: "exact", head: true })
        .not("reason", "is", null)
        .neq("reason", ""),
    ]);

  const rows: AdminWithdrawal[] = (rowsRes.data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    email: r.email,
    reason: r.reason,
    hadPayments: r.had_payments,
    deletedAt: r.deleted_at,
  }));

  return {
    rows,
    totalCount: totalCount ?? rows.length,
    withReasonCount: withReasonCount ?? 0,
  };
}
