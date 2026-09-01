import { createClient } from "@/lib/supabase/server";

export interface DailyCount {
  /** YYYY-MM-DD (KST) */
  date: string;
  views: number;
}

export interface AnalyticsData {
  totalViews: number;
  views30d: number;
  shares30d: number;
  daily: DailyCount[]; // 최근 14일
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

function refSource(referrer: string | null): string {
  if (!referrer) return "직접 방문";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return host || "직접 방문";
  } catch {
    return "기타";
  }
}

/** 최근 30일 이벤트를 모아 대시보드용 지표로 집계한다 (RLS: 소유자만). */
export async function getAnalytics(businessId: string): Promise<AnalyticsData> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * DAY).toISOString();

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
      .limit(20000),
  ]);

  const rows = events ?? [];
  const views = rows.filter((r) => r.event === "page_view");
  const shares = rows.filter((r) => r.event === "share");

  // 최근 14일 일별 조회수 (빈 날짜 포함)
  const byDay = new Map<string, number>();
  for (const v of views) {
    const d = kstDate(v.created_at);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const daily: DailyCount[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = kstDate(new Date(Date.now() - i * DAY));
    daily.push({ date: d, views: byDay.get(d) ?? 0 });
  }

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
    views30d: views.length,
    shares30d: shares.length,
    daily,
    topPaths: countBy(views, (v) => v.path || "/")
      .slice(0, 8)
      .map(([path, views]) => ({ path, views })),
    referrers: countBy(views, (v) => refSource(v.referrer))
      .slice(0, 6)
      .map(([source, count]) => ({ source, count })),
    shareByChannel: countBy(shares, (s) => s.channel ?? "기타").map(
      ([channel, count]) => ({ channel, count }),
    ),
  };
}
