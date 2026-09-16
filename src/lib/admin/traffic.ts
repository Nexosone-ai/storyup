import { createAdminClient } from "@/lib/supabase/server";
import { growthPct } from "@/lib/analytics";

/** 관리자 전체 트래픽 — 호출 전 반드시 isCurrentUserAdmin() 확인. */

const DAY = 24 * 60 * 60 * 1000;

function kstDate(iso: string | Date): string {
  const d = new Date(iso).getTime() + 9 * 60 * 60 * 1000;
  return new Date(d).toISOString().slice(0, 10);
}

function refSource(referrer: string | null): string {
  if (!referrer) return "직접 방문";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "") || "직접 방문";
  } catch {
    return "기타";
  }
}

export interface AdminTraffic {
  totalViews: number;
  views30d: number;
  viewsPrev30d: number;
  viewsGrowthPct: number;
  views7d: number;
  views7dGrowthPct: number;
  shares30d: number;
  activeBusinesses30d: number;
  trend: { date: string; views: number }[];
  topBusinesses: { businessId: string; name: string; views: number }[];
  referrers: { source: string; count: number }[];
}

/** 전체 사업체의 site_events를 합산한 플랫폼 트래픽 지표. */
export async function getTrafficAdmin(): Promise<AdminTraffic> {
  const admin = createAdminClient();
  const now = Date.now();
  const since = new Date(now - 60 * DAY).toISOString();

  const [{ count: totalViews }, { data: events }] = await Promise.all([
    admin
      .from("site_events")
      .select("id", { count: "exact", head: true })
      .eq("event", "page_view"),
    admin
      .from("site_events")
      .select("event, business_id, referrer, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(80000),
  ]);

  const rows = events ?? [];
  const views = rows.filter((r) => r.event === "page_view");
  const shares = rows.filter((r) => r.event === "share");

  const inWin = (iso: string, from: number, to: number) => {
    const t = new Date(iso).getTime();
    return t >= now - from * DAY && t < now - to * DAY;
  };
  const v30 = views.filter((v) => inWin(v.created_at, 30, 0));
  const v30prev = views.filter((v) => inWin(v.created_at, 60, 30));
  const v7 = views.filter((v) => inWin(v.created_at, 7, 0));
  const v7prev = views.filter((v) => inWin(v.created_at, 14, 7));

  // 30일 추이
  const byDay = new Map<string, number>();
  for (const v of views) {
    const d = kstDate(v.created_at);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const trend: { date: string; views: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = kstDate(new Date(now - i * DAY));
    trend.push({ date: d, views: byDay.get(d) ?? 0 });
  }

  // 사업체별 조회수(30일) 상위
  const perBiz = new Map<string, number>();
  for (const v of v30)
    perBiz.set(v.business_id, (perBiz.get(v.business_id) ?? 0) + 1);
  const topIds = [...perBiz.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const nameMap = new Map<string, string>();
  if (topIds.length) {
    const { data: bizList } = await admin
      .from("businesses")
      .select("id, name")
      .in(
        "id",
        topIds.map(([id]) => id),
      );
    for (const b of bizList ?? []) nameMap.set(b.id, b.name);
  }
  const topBusinesses = topIds.map(([businessId, v]) => ({
    businessId,
    name: nameMap.get(businessId) ?? "(삭제된 사업체)",
    views: v,
  }));

  // 유입 경로(30일)
  const refMap = new Map<string, number>();
  for (const v of v30) {
    const s = refSource(v.referrer);
    refMap.set(s, (refMap.get(s) ?? 0) + 1);
  }
  const referrers = [...refMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([source, count]) => ({ source, count }));

  return {
    totalViews: totalViews ?? 0,
    views30d: v30.length,
    viewsPrev30d: v30prev.length,
    viewsGrowthPct: growthPct(v30.length, v30prev.length),
    views7d: v7.length,
    views7dGrowthPct: growthPct(v7.length, v7prev.length),
    shares30d: shares.filter((s) => inWin(s.created_at, 30, 0)).length,
    activeBusinesses30d: perBiz.size,
    trend,
    topBusinesses,
    referrers,
  };
}
