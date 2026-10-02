import { createAdminClient } from "@/lib/supabase/server";

/**
 * 관리자 포인트 원장 조회 — 호출 전 반드시 isCurrentUserAdmin() 확인(레이아웃 가드).
 * point_transactions가 UP·크레딧 통합 원장이다. 모든 입/출금(적립·지급·사용·환불)이
 * 여기 쌓이므로, 포인트가 어떻게 들어오고 나가는지 전부 이 테이블로 설명된다.
 */

/** 거래 유형 — point_transactions.type */
export type PointTxType =
  | "REWARD"
  | "PLAN_CREDIT"
  | "ADMIN_CREDIT"
  | "PURCHASE"
  | "BONUS"
  | "REFUND"
  | "AI_USAGE";

export interface AdminPointTx {
  id: string;
  userId: string;
  name: string;
  email: string;
  amount: number;
  type: string | null;
  reason: string | null;
  createdAt: string;
}

export interface PointTypeTotal {
  type: string;
  count: number;
  total: number;
}

export interface AdminPointsLedger {
  /** 최근 거래 (limit 적용) */
  txns: AdminPointTx[];
  /** 전체 거래 수 (limit과 무관) */
  totalCount: number;
  /** 유형별 전체 집계 (전 기간) */
  byType: PointTypeTotal[];
  /** 전 기간 적립 합계(+ 금액 총합) */
  totalIn: number;
  /** 전 기간 사용·회수 합계(− 금액 총합, 양수로 표기) */
  totalOut: number;
  /** 미사용 순 잔액 = 모든 금액 합 */
  netBalance: number;
}

/** 최근 거래 목록 + 전 기간 유형별 집계. */
export async function getPointsLedgerAdmin(
  limit = 200,
): Promise<AdminPointsLedger> {
  const admin = createAdminClient();

  const [txRes, aggRes, { count }] = await Promise.all([
    admin
      .from("point_transactions")
      .select("id,user_id,amount,type,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    // 전 기간 유형별 집계는 DB 함수로 — 전체 행을 끌어오면 1,000행 상한에 걸린다.
    admin.rpc("admin_point_totals"),
    admin
      .from("point_transactions")
      .select("id", { count: "exact", head: true }),
  ]);

  const rows = txRes.data ?? [];

  // 거래자 이름·이메일 매핑
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const emailByUser = new Map<string, { name: string; email: string }>();
  if (ids.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id,name,email")
      .in("user_id", ids);
    for (const p of profiles ?? [])
      emailByUser.set(p.user_id, {
        name: p.name ?? "이름 없음",
        email: p.email ?? "",
      });
  }

  const txns: AdminPointTx[] = rows.map((r) => {
    const who = emailByUser.get(r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      name: who?.name ?? "알 수 없음",
      email: who?.email ?? "",
      amount: r.amount,
      type: r.type,
      reason: r.reason,
      createdAt: r.created_at,
    };
  });

  // 전 기간 집계 (DB GROUP BY 결과)
  const agg = aggRes.data ?? [];
  let totalIn = 0;
  let totalOut = 0;
  let netBalance = 0;
  for (const r of agg) {
    totalIn += r.pos;
    totalOut += -r.neg;
    netBalance += r.total;
  }
  const byType: PointTypeTotal[] = agg
    .map((r) => ({ type: r.type, count: r.cnt, total: r.total }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  return {
    txns,
    totalCount: count ?? txns.length,
    byType,
    totalIn,
    totalOut,
    netBalance,
  };
}
