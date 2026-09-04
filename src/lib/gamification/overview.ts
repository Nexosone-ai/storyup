import { createAdminClient } from "@/lib/supabase/server";
import { getPointBreakdown } from "@/lib/payments/service";
import {
  loadSettings,
  levelForXp,
  type LevelInfo,
  type MissionDef,
  type QuestItemDef,
  type RewardRule,
} from "./config";
import {
  kstDayStartIso,
  kstWeekStartIso,
  kstDate,
  isoWeekKey,
  pickDailyMissions,
  getUserContentState,
  type StreakState,
} from "./engine";
import {
  ACHIEVEMENTS,
  checkTrafficAchievement,
  checkSearchAchievements,
  type AchievementDef,
} from "./achievements";
import { ensureUserSetup, getReferralStats, type ReferralStats } from "./referral";
import {
  computeStoryScore,
  snapshotStoryScore,
  nextActionFor,
  type StoryScore,
  type NextAction,
} from "./score";

/** 대시보드 성장 패널에 필요한 모든 데이터 (직렬화 가능). */
export interface GrowthOverview {
  balance: number; // UP
  xp: number;
  level: LevelInfo;
  streak: StreakState;
  missions: Array<MissionDef & { done: boolean; reward: RewardRule }>;
  dailyCleared: boolean;
  weekly: Array<QuestItemDef & { done: number }>;
  weeklyCleared: boolean;
  weeklyReward: RewardRule;
  dailyClearReward: RewardRule;
  score: StoryScore;
  nextAction: NextAction;
  achievements: Array<AchievementDef & { achieved: boolean; achievedAt: string | null }>;
  recentRewards: Array<{ id: string; rule: string; up: number; xp: number; created_at: string }>;
  referral: ReferralStats & { inviteRewarded: boolean };
  primaryBusinessId: string | null;
  /** Google Search Console 성과 (미연동/데이터 없음이면 null) */
  search: { impressions: number; clicks: number } | null;
}

/**
 * 성장 대시보드 데이터 — 가입 보너스/추천 귀속(멱등)도 여기서 처리한다.
 * 어떤 하위 조회가 실패해도(마이그레이션 전) 0값으로 렌더링 가능해야 한다.
 */
export async function getGrowthOverview(
  userId: string,
  pendingRefCode?: string | null,
): Promise<GrowthOverview> {
  const settings = await loadSettings();
  const admin = createAdminClient();

  // 멱등 셋업: 가입 보너스 + 추천 코드 + 추천 귀속 + 트래픽/검색 업적
  await ensureUserSetup(userId, pendingRefCode);
  await checkTrafficAchievement(userId);
  // Search Console 성과(하루 1회 갱신·캐시) — 검색 업적과 SEO 점수에 반영
  const searchTotals = await checkSearchAchievements(userId);

  // supabase-js는 throw하지 않고 {data, error}를 돌려준다 — 마이그레이션 전에는
  // error와 함께 data가 비므로 아래 ?? 기본값으로 안전하게 렌더링된다.
  const [
    breakdown,
    xpRow,
    streakRow,
    todayActs,
    weekActs,
    achievedRows,
    recent,
    referral,
    contentState,
    business,
    dailyClearRow,
    weeklyRow,
    inviteRow,
  ] = await Promise.all([
    getPointBreakdown(userId).catch(() => ({
      balance: 0,
      purchased: 0,
      used: 0,
      refunded: 0,
      purchasedRemaining: 0,
    })),
    admin.from("user_xp").select("xp").eq("user_id", userId).maybeSingle(),
    admin
      .from("user_streaks")
      .select("current, longest, last_date, started")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("activity_events")
      .select("action")
      .eq("user_id", userId)
      .gte("created_at", kstDayStartIso()),
    admin
      .from("activity_events")
      .select("action")
      .eq("user_id", userId)
      .gte("created_at", kstWeekStartIso()),
    admin
      .from("user_achievements")
      .select("code, created_at")
      .eq("user_id", userId),
    admin
      .from("reward_events")
      .select("id, rule, up, xp, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
    getReferralStats(userId),
    getUserContentState(userId),
    admin
      .from("businesses")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from("reward_events")
      .select("id")
      .eq("user_id", userId)
      .eq("reward_key", `daily_clear:${kstDate()}`)
      .maybeSingle(),
    admin
      .from("reward_events")
      .select("id")
      .eq("user_id", userId)
      .eq("reward_key", `weekly:${isoWeekKey()}`)
      .maybeSingle(),
    admin
      .from("reward_events")
      .select("id")
      .eq("user_id", userId)
      .eq("reward_key", "ref_invite")
      .maybeSingle(),
  ]);

  const xp = xpRow.data?.xp ?? 0;
  const streak: StreakState = {
    current:
      streakRow.data &&
      (streakRow.data.last_date === kstDate() ||
        streakRow.data.last_date === kstDate(-1))
        ? streakRow.data.current
        : 0,
    longest: streakRow.data?.longest ?? 0,
    lastDate: streakRow.data?.last_date ?? null,
    started: streakRow.data?.started ?? null,
  };

  const doneToday = new Set((todayActs.data ?? []).map((a) => a.action));
  const missions = pickDailyMissions(settings, userId, contentState).map((m) => ({
    ...m,
    done: doneToday.has(m.action),
    reward: settings.rules[m.rewardRule] ?? { up: 0, xp: 0 },
  }));

  const weekCounts = new Map<string, number>();
  for (const a of weekActs.data ?? [])
    weekCounts.set(a.action, (weekCounts.get(a.action) ?? 0) + 1);
  const weekly = settings.weeklyQuest.map((q) => ({
    ...q,
    done: Math.min(q.target, weekCounts.get(q.action) ?? 0),
  }));

  const score = await computeStoryScore(userId);
  await snapshotStoryScore(userId, score);

  const achievedMap = new Map(
    (achievedRows.data ?? []).map((r) => [r.code, r.created_at]),
  );
  const achievements = ACHIEVEMENTS.map((a) => ({
    ...a,
    achieved: achievedMap.has(a.code),
    achievedAt: achievedMap.get(a.code) ?? null,
  }));

  return {
    balance: breakdown.balance,
    xp,
    level: levelForXp(xp, settings.levels),
    streak,
    missions,
    dailyCleared: !!dailyClearRow.data,
    weekly,
    weeklyCleared: !!weeklyRow.data,
    weeklyReward: settings.rules.weekly_quest ?? { up: 500, xp: 500 },
    dailyClearReward: settings.rules.daily_clear ?? { up: 100, xp: 100 },
    score,
    nextAction: nextActionFor(score, business.data?.id ?? null),
    achievements,
    recentRewards: recent.data ?? [],
    referral: { ...referral, inviteRewarded: !!inviteRow.data },
    primaryBusinessId: business.data?.id ?? null,
    search: searchTotals,
  };
}
