import { createClient } from "@/lib/supabase/server";
import { growthPct } from "@/lib/analytics";

/**
 * 성과 리포트 — 계정(사용자)의 모든 사업장을 합산한 기간별 지표.
 * 기간: "week"(최근 7일) | "month"(최근 30일). 직전 동일 기간과 비교해 증감을 낸다.
 * RLS(소유 사업장)로 조회하므로 본인 데이터만 집계된다.
 * 플랜 게이팅: Basic=월간, Pro/Partner=주간+월간 ([src/lib/plans.ts] plan.report).
 */

const DAY = 24 * 60 * 60 * 1000;

export type ReportPeriod = "week" | "month";

export interface ReportMetric {
  current: number;
  previous: number;
  growthPct: number;
}

export interface PerformanceReport {
  period: ReportPeriod;
  /** 집계 대상 사업장 수 */
  businesses: number;
  /** 기간 라벨용 시작·종료(ISO) */
  from: string;
  to: string;
  visits: ReportMetric;
  leads: ReportMetric;
  blogPublished: ReportMetric;
}

/** [fromDaysAgo, toDaysAgo) 구간의 business_id·created_at 조건 count. */
async function countIn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  businessIds: string[],
  dateCol: string,
  fromIso: string,
  toIso: string,
  extra?: (q: ReturnType<Awaited<ReturnType<typeof createClient>>["from"]>) => unknown,
): Promise<number> {
  let q = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in("business_id", businessIds)
    .gte(dateCol, fromIso)
    .lt(dateCol, toIso);
  if (extra) q = extra(q) as typeof q;
  const { count } = await q;
  return count ?? 0;
}

async function metric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  businessIds: string[],
  dateCol: string,
  now: number,
  span: number,
  extra?: (q: ReturnType<Awaited<ReturnType<typeof createClient>>["from"]>) => unknown,
): Promise<ReportMetric> {
  const curFrom = new Date(now - span).toISOString();
  const curTo = new Date(now).toISOString();
  const prevFrom = new Date(now - 2 * span).toISOString();
  const prevTo = curFrom;
  const [current, previous] = await Promise.all([
    countIn(supabase, table, businessIds, dateCol, curFrom, curTo, extra),
    countIn(supabase, table, businessIds, dateCol, prevFrom, prevTo, extra),
  ]);
  return { current, previous, growthPct: growthPct(current, previous) };
}

export async function getPerformanceReport(
  userId: string,
  period: ReportPeriod,
): Promise<PerformanceReport> {
  const supabase = await createClient();
  const span = (period === "week" ? 7 : 30) * DAY;
  const now = Date.now();

  const { data: bizRows } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId);
  const businessIds = (bizRows ?? []).map((b) => b.id as string);

  const empty: ReportMetric = { current: 0, previous: 0, growthPct: 0 };
  if (businessIds.length === 0) {
    return {
      period,
      businesses: 0,
      from: new Date(now - span).toISOString(),
      to: new Date(now).toISOString(),
      visits: empty,
      leads: empty,
      blogPublished: empty,
    };
  }

  const [visits, coupons, inquiries, blogPublished] = await Promise.all([
    // 방문 = site_events page_view
    metric(supabase, "site_events", businessIds, "created_at", now, span, (q) =>
      q.eq("event", "page_view"),
    ),
    // 리드(쿠폰 수령)
    metric(supabase, "coupon_claims", businessIds, "created_at", now, span),
    // 리드(문의)
    metric(supabase, "site_inquiries", businessIds, "created_at", now, span),
    // 블로그 발행
    metric(supabase, "blog_posts", businessIds, "published_at", now, span, (q) =>
      q.eq("status", "published"),
    ),
  ]);

  const leads: ReportMetric = {
    current: coupons.current + inquiries.current,
    previous: coupons.previous + inquiries.previous,
    growthPct: growthPct(
      coupons.current + inquiries.current,
      coupons.previous + inquiries.previous,
    ),
  };

  return {
    period,
    businesses: businessIds.length,
    from: new Date(now - span).toISOString(),
    to: new Date(now).toISOString(),
    visits,
    leads,
    blogPublished,
  };
}
