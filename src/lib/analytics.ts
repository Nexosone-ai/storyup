import { createClient } from "@/lib/supabase/server";

export interface DailyCount {
  /** YYYY-MM-DD (KST) */
  date: string;
  views: number;
}

export interface AnalyticsData {
  totalViews: number;
  views30d: number;
  viewsPrev30d: number;
  /** 최근 30일 vs 직전 30일 조회수 증감율(%) */
  viewsGrowthPct: number;
  views7d: number;
  views7dPrev: number;
  views7dGrowthPct: number;
  shares30d: number;
  daily: DailyCount[]; // 최근 14일 (하위 호환)
  trend: DailyCount[]; // 최근 30일 추이 그래프용
  topPaths: { path: string; views: number }[];
  referrers: { source: string; count: number }[];
  shareByChannel: { channel: string; count: number }[];
}

const DAY = 24 * 60 * 60 * 1000;

/** KST 기준 YYYY-MM-DD */
function kstDate(iso: string | Date): string {
  const d = new Date(iso).getTime() + 9 * 60 * 60 * 1000;
  return new Date(d).toISOString().slice(0, 10);
}

/** 증감율(%) — 직전 값이 0이면 현재>0일 때 100%, 아니면 0%. 정수 반올림. */
export function growthPct(cur: number, prev: number): number {
  if (prev <= 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

function refSource(referrer: string | null): string {
  if (!referrer) return "직접 방문";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return host || "직접 방문";
  } catch {
    return "기타";
  }
}

/** 최근 60일 이벤트를 모아 대시보드용 지표로 집계한다 (RLS: 소유자만). */
export async function getAnalytics(businessId: string): Promise<AnalyticsData> {
  const supabase = await createClient();
  const now = Date.now();
  const since = new Date(now - 60 * DAY).toISOString();

  const [{ count: totalViews }, { data: events }] = await Promise.all([
    supabase
      .from("site_events")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("event", "page_view"),
    supabase
      .from("site_events")
      .select("event, path, channel, referrer, created_at")
      .eq("business_id", businessId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40000),
  ]);

  const rows = events ?? [];
  const views = rows.filter((r) => r.event === "page_view");
  const shares = rows.filter((r) => r.event === "share");

  const inWindow = (iso: string, fromDaysAgo: number, toDaysAgo: number) => {
    const t = new Date(iso).getTime();
    return t >= now - fromDaysAgo * DAY && t < now - toDaysAgo * DAY;
  };
  const views30d = views.filter((v) => inWindow(v.created_at, 30, 0)).length;
  const viewsPrev30d = views.filter((v) => inWindow(v.created_at, 60, 30)).length;
  const views7d = views.filter((v) => inWindow(v.created_at, 7, 0)).length;
  const views7dPrev = views.filter((v) => inWindow(v.created_at, 14, 7)).length;

  // 일별 조회수 (빈 날짜 포함)
  const byDay = new Map<string, number>();
  for (const v of views) {
    const d = kstDate(v.created_at);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const series = (days: number): DailyCount[] => {
    const out: DailyCount[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = kstDate(new Date(now - i * DAY));
      out.push({ date: d, views: byDay.get(d) ?? 0 });
    }
    return out;
  };

  // 30일 집계용 (경로·유입·공유는 최근 30일만)
  const views30 = views.filter((v) => inWindow(v.created_at, 30, 0));
  const shares30 = shares.filter((s) => inWindow(s.created_at, 30, 0));

  const countBy = <T>(items: T[], key: (t: T) => string) => {
    const m = new Map<string, number>();
    for (const it of items) {
      const k = key(it);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  return {
    totalViews: totalViews ?? 0,
    views30d,
    viewsPrev30d,
    viewsGrowthPct: growthPct(views30d, viewsPrev30d),
    views7d,
    views7dPrev,
    views7dGrowthPct: growthPct(views7d, views7dPrev),
    shares30d: shares30.length,
    daily: series(14),
    trend: series(30),
    topPaths: countBy(views30, (v) => v.path || "/")
      .slice(0, 8)
      .map(([path, n]) => ({ path, views: n })),
    referrers: countBy(views30, (v) => refSource(v.referrer))
      .slice(0, 6)
      .map(([source, count]) => ({ source, count })),
    shareByChannel: countBy(shares30, (s) => s.channel ?? "기타").map(
      ([channel, count]) => ({ channel, count }),
    ),
  };
}

// ===================== 고객·쿠폰 인사이트 =====================

export interface CouponInsights {
  issued: number;
  used: number;
  usageRate: number; // 0~100
  byPost: {
    postId: string | null;
    title: string;
    issued: number;
    used: number;
  }[];
}

export interface LeadInsights {
  total: number;
  new30d: number;
  prev30d: number;
  growthPct: number;
  viaCoupon: number;
  viaInquiry: number;
}

export interface CustomerInsights {
  coupon: CouponInsights;
  leads: LeadInsights;
}

/**
 * 식별된 고객(리드) + 쿠폰 성과 집계.
 * 고객 = 연락처를 남긴 사람 = 쿠폰 수령자(coupon_claims) + 문의자(site_inquiries).
 * 0027 이전 DB에서는 테이블이 없어 안전하게 0으로 수렴한다.
 */
export async function getCustomerInsights(
  businessId: string,
): Promise<CustomerInsights> {
  const supabase = await createClient();
  const now = Date.now();

  const [{ data: claims }, { data: inquiries }, { data: bizEvents }] =
    await Promise.all([
      supabase
        .from("coupon_claims")
        .select("event_id, used_at, created_at")
        .eq("business_id", businessId),
      supabase
        .from("site_inquiries")
        .select("created_at")
        .eq("business_id", businessId),
      supabase
        .from("blog_events")
        .select("id, post_id")
        .eq("business_id", businessId),
    ]);

  const claimRows = claims ?? [];
  const inquiryRows = inquiries ?? [];

  // event_id → post_id
  const eventToPost = new Map(
    (bizEvents ?? []).map((e) => [e.id, e.post_id]),
  );
  const postIds = [
    ...new Set((bizEvents ?? []).map((e) => e.post_id).filter(Boolean)),
  ];
  const postTitle = new Map<string, string>();
  if (postIds.length) {
    const { data: posts } = await supabase
      .from("blog_posts")
      .select("id, title")
      .in("id", postIds);
    for (const p of posts ?? []) postTitle.set(p.id, p.title);
  }

  const issued = claimRows.length;
  const used = claimRows.filter((c) => c.used_at).length;

  // 게시글별 쿠폰 집계
  const perPost = new Map<
    string,
    { postId: string | null; title: string; issued: number; used: number }
  >();
  for (const c of claimRows) {
    const postId = eventToPost.get(c.event_id) ?? null;
    const key = postId ?? "unknown";
    const cur =
      perPost.get(key) ??
      {
        postId,
        title: postId ? (postTitle.get(postId) ?? "삭제된 글") : "기타",
        issued: 0,
        used: 0,
      };
    cur.issued += 1;
    if (c.used_at) cur.used += 1;
    perPost.set(key, cur);
  }
  const byPost = [...perPost.values()].sort((a, b) => b.issued - a.issued);

  // 고객(리드) — 쿠폰 수령 + 문의
  const inWin = (iso: string, fromDaysAgo: number, toDaysAgo: number) => {
    const t = new Date(iso).getTime();
    return t >= now - fromDaysAgo * DAY && t < now - toDaysAgo * DAY;
  };
  const allDates = [
    ...claimRows.map((c) => c.created_at),
    ...inquiryRows.map((i) => i.created_at),
  ];
  const new30d = allDates.filter((d) => inWin(d, 30, 0)).length;
  const prev30d = allDates.filter((d) => inWin(d, 60, 30)).length;

  return {
    coupon: {
      issued,
      used,
      usageRate: issued > 0 ? Math.round((used / issued) * 100) : 0,
      byPost,
    },
    leads: {
      total: claimRows.length + inquiryRows.length,
      new30d,
      prev30d,
      growthPct: growthPct(new30d, prev30d),
      viaCoupon: claimRows.length,
      viaInquiry: inquiryRows.length,
    },
  };
}
