import { createAdminClient } from "@/lib/supabase/server";
import {
  fetchSearchTotalsForSlugs,
  isSearchConsoleConfigured,
  type SearchTotals,
} from "@/lib/searchConsole";
import { award, type AwardResult, type GrowthAction } from "./engine";

/**
 * 업적(Badge) 정의와 달성 검사.
 * 달성 여부는 실제 데이터(activity_events·user_streaks·referrals·site_events)로만 판단하고,
 * user_achievements PK(user_id, code)로 1회만 기록·보상한다.
 */

export interface AchievementDef {
  code: string;
  emoji: string;
  labelKo: string;
  labelEn: string;
  descKo: string;
  descEn: string;
  up: number;
  xp: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "first_story", emoji: "🏆", labelKo: "First Story", labelEn: "First Story", descKo: "첫 블로그 발행", descEn: "Publish your first blog post", up: 50, xp: 100 },
  { code: "website_builder", emoji: "🏗️", labelKo: "Website Builder", labelEn: "Website Builder", descKo: "첫 홈페이지 완성", descEn: "Create your first landing page", up: 50, xp: 100 },
  { code: "streak_7", emoji: "🔥", labelKo: "Story Streak 7", labelEn: "Story Streak 7", descKo: "7일 연속 활동", descEn: "7-day activity streak", up: 0, xp: 200 },
  { code: "streak_30", emoji: "🔥", labelKo: "Story Streak 30", labelEn: "Story Streak 30", descKo: "30일 연속 활동", descEn: "30-day activity streak", up: 0, xp: 500 },
  { code: "streak_100", emoji: "💯", labelKo: "Story Streak 100", labelEn: "Story Streak 100", descKo: "100일 연속 활동", descEn: "100-day activity streak", up: 0, xp: 2000 },
  { code: "content_10", emoji: "✍️", labelKo: "Content Creator", labelEn: "Content Creator", descKo: "콘텐츠 10개 발행", descEn: "Publish 10 pieces of content", up: 100, xp: 300 },
  { code: "content_100", emoji: "🚀", labelKo: "Pro Creator", labelEn: "Pro Creator", descKo: "콘텐츠 100개 발행", descEn: "Publish 100 pieces of content", up: 500, xp: 1000 },
  { code: "views_100", emoji: "👀", labelKo: "Views 100", labelEn: "Views 100", descKo: "내 사이트 조회 100회 달성", descEn: "Reach 100 site views", up: 100, xp: 300 },
  { code: "google_debut", emoji: "🌐", labelKo: "Google Debut", labelEn: "Google Debut", descKo: "첫 Google 검색 노출", descEn: "First Google search impression", up: 100, xp: 200 },
  { code: "search_100", emoji: "🔍", labelKo: "Search 100", labelEn: "Search 100", descKo: "Google 검색 노출 100회", descEn: "100 Google search impressions", up: 100, xp: 300 },
  { code: "traffic_100", emoji: "📈", labelKo: "Traffic 100", labelEn: "Traffic 100", descKo: "Google 검색 유입 100명", descEn: "100 visitors from Google search", up: 200, xp: 500 },
  { code: "ambassador", emoji: "🤝", labelKo: "Ambassador", labelEn: "Ambassador", descKo: "친구 5명 초대 성공", descEn: "Refer 5 friends", up: 200, xp: 500 },
  { code: "story_partner", emoji: "🌟", labelKo: "Story Partner", labelEn: "Story Partner", descKo: "친구 20명 초대 성공", descEn: "Refer 20 friends", up: 500, xp: 1000 },
  { code: "story_leader", emoji: "👑", labelKo: "Story Leader", labelEn: "Story Leader", descKo: "친구 100명 초대 성공", descEn: "Refer 100 friends", up: 2000, xp: 5000 },
];

const BY_CODE = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));

/** 업적 1개 기록 + 보상 (이미 있으면 아무것도 안 함). */
export async function grantAchievement(
  userId: string,
  code: string,
): Promise<AwardResult | null> {
  const def = BY_CODE.get(code);
  if (!def) return null;
  try {
    const admin = createAdminClient();
    const { error, count } = await admin
      .from("user_achievements")
      .insert({ user_id: userId, code }, { count: "exact" });
    if (error) return null; // 중복(23505) 또는 마이그레이션 전
    if ((count ?? 0) === 0) return null;
    const res = await award(userId, "achievement", `achievement:${code}`, {
      upOverride: def.up,
      xpOverride: def.xp,
      reason: `업적 달성 — ${def.labelKo}`,
    });
    return res.granted ? res : null;
  } catch {
    return null;
  }
}

/** 행동 이후 관련 업적만 검사한다 (불필요한 쿼리 최소화). */
export async function checkAchievements(
  userId: string,
  action: GrowthAction,
  streakCurrent: number,
): Promise<AwardResult[]> {
  const out: AwardResult[] = [];
  try {
    const admin = createAdminClient();

    if (action === "blog_published") {
      const r = await grantAchievement(userId, "first_story");
      if (r) out.push(r);
    }
    if (action === "site_created") {
      const r = await grantAchievement(userId, "website_builder");
      if (r) out.push(r);
    }
    if (streakCurrent >= 7) {
      const r = await grantAchievement(userId, "streak_7");
      if (r) out.push(r);
    }
    if (streakCurrent >= 30) {
      const r = await grantAchievement(userId, "streak_30");
      if (r) out.push(r);
    }
    if (streakCurrent >= 100) {
      const r = await grantAchievement(userId, "streak_100");
      if (r) out.push(r);
    }

    if (action === "blog_published" || action === "card_created") {
      const { count } = await admin
        .from("activity_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("action", ["blog_published", "card_created"]);
      const n = count ?? 0;
      if (n >= 10) {
        const r = await grantAchievement(userId, "content_10");
        if (r) out.push(r);
      }
      if (n >= 100) {
        const r = await grantAchievement(userId, "content_100");
        if (r) out.push(r);
      }
    }
  } catch {
    /* 무시 */
  }
  return out;
}

/** 추천 수 기반 업적 — referral 처리 시 호출. */
export async function checkReferralAchievements(
  userId: string,
  referredCount: number,
): Promise<AwardResult[]> {
  const out: AwardResult[] = [];
  const tiers: Array<[number, string]> = [
    [5, "ambassador"],
    [20, "story_partner"],
    [100, "story_leader"],
  ];
  for (const [n, code] of tiers) {
    if (referredCount >= n) {
      const r = await grantAchievement(userId, code);
      if (r) out.push(r);
    }
  }
  return out;
}

/** 사이트 누적 조회 업적 — 대시보드 로드 시 검사 (이벤트 훅이 없는 지표). */
export async function checkTrafficAchievement(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: already } = await admin
      .from("user_achievements")
      .select("code")
      .eq("user_id", userId)
      .eq("code", "views_100")
      .maybeSingle();
    if (already) return;
    const { data: businesses } = await admin
      .from("businesses")
      .select("id")
      .eq("user_id", userId);
    const ids = (businesses ?? []).map((b) => b.id);
    if (ids.length === 0) return;
    const { count } = await admin
      .from("site_events")
      .select("id", { count: "exact", head: true })
      .in("business_id", ids)
      .eq("event", "page_view");
    if ((count ?? 0) >= 100) await grantAchievement(userId, "views_100");
  } catch {
    /* 무시 */
  }
}

/**
 * Google Search Console 성과 조회 + 검색 업적 검사.
 * API 호출은 사용자당 하루 1회로 제한하고 결과를 search_stats에 캐시한다.
 * GSC 미설정/오류 시 캐시 값(없으면 0)으로만 판정하고 조용히 넘어간다.
 */
export async function checkSearchAchievements(
  userId: string,
): Promise<SearchTotals | null> {
  try {
    const admin = createAdminClient();
    const { data: cached, error: cacheErr } = await admin
      .from("search_stats")
      .select("impressions, clicks, checked_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (cacheErr) return null; // 마이그레이션 전

    let totals: SearchTotals | null = cached
      ? { impressions: cached.impressions, clicks: cached.clicks }
      : null;

    const stale =
      !cached ||
      Date.now() - new Date(cached.checked_at).getTime() > 24 * 3_600_000;

    if (stale && isSearchConsoleConfigured()) {
      const { data: businesses } = await admin
        .from("businesses")
        .select("slug")
        .eq("user_id", userId);
      const slugs = (businesses ?? []).map((b) => b.slug).filter(Boolean);
      const fresh = await fetchSearchTotalsForSlugs(slugs);
      if (fresh) {
        totals = fresh;
        await admin.from("search_stats").upsert({
          user_id: userId,
          impressions: fresh.impressions,
          clicks: fresh.clicks,
          checked_at: new Date().toISOString(),
        });
      } else if (cached) {
        // 조회 실패 시 재시도 폭주를 막기 위해 시각만 갱신
        await admin
          .from("search_stats")
          .update({ checked_at: new Date().toISOString() })
          .eq("user_id", userId);
      }
    }

    if (!totals) return null;
    if (totals.impressions >= 1) await grantAchievement(userId, "google_debut");
    if (totals.impressions >= 100) await grantAchievement(userId, "search_100");
    if (totals.clicks >= 100) await grantAchievement(userId, "traffic_100");
    return totals;
  } catch {
    return null;
  }
}
