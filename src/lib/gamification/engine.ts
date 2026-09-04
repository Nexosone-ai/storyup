import { createAdminClient } from "@/lib/supabase/server";
import {
  loadSettings,
  STREAK_MILESTONES,
  type GamificationSettings,
} from "./config";
import { checkAchievements } from "./achievements";

/**
 * Reward Engine — 모든 지급은 서버에서만, reward_events 멱등키로 중복 차단.
 * 어떤 실패도 삼킨다: 게이미피케이션 오류가 기존 기능(생성·발행)을 깨면 안 된다.
 */

/** 성장 활동 종류 — activity_events.action 값 */
export type GrowthAction =
  | "brand_profile"
  | "site_created"
  | "site_updated"
  | "blog_created"
  | "blog_published"
  | "blog_edited"
  | "card_created"
  | "share";

const REASON_KO: Record<string, string> = {
  signup: "가입 축하 보너스",
  brand_profile: "브랜드 프로필 완성 보상",
  site_created: "홈페이지 생성 보상",
  site_updated: "홈페이지 업데이트 보상",
  blog_created: "블로그 작성 보상",
  blog_published: "블로그 발행 보상",
  card_created: "SNS 카드뉴스 생성 보상",
  share: "콘텐츠 공유 보상",
  ref_invite: "친구 초대 시작 보너스",
  ref_signup: "친구 가입 완료 보상",
  ref_paid: "추천 사용자 유료 전환 보상",
  daily_clear: "데일리 미션 올클리어 보너스",
  weekly_quest: "위클리 퀘스트 완료 보상",
  streak_3: "3일 연속 활동 보상",
  streak_7: "7일 연속 활동 보상",
  streak_14: "14일 연속 활동 보상",
  streak_30: "30일 연속 활동 보상",
  streak_100: "100일 연속 활동 보상",
  achievement: "업적 달성 보상",
  surprise: "🎁 서프라이즈 보너스",
};

// ---------- 날짜 (서버 KST 기준 — 클라이언트 시계 조작 불가) ----------

const KST_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** KST 기준 YYYY-MM-DD */
export function kstDate(offsetDays = 0): string {
  return KST_FMT.format(new Date(Date.now() + offsetDays * 86_400_000));
}

/** KST 자정의 UTC ISO 문자열 (오늘 집계의 하한) */
export function kstDayStartIso(dateStr = kstDate()): string {
  return new Date(`${dateStr}T00:00:00+09:00`).toISOString();
}

/** ISO 주 키 예: 2026-W36 (KST 기준) */
export function isoWeekKey(dateStr = kstDate()): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** 이번 ISO 주 월요일(KST)의 UTC ISO — 주간 집계 하한 */
export function kstWeekStartIso(dateStr = kstDate()): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  const kstDay = new Date(`${dateStr}T00:00:00Z`).getUTCDay() || 7;
  return new Date(d.getTime() - (kstDay - 1) * 86_400_000).toISOString();
}

// ---------- 보상 지급 ----------

export interface AwardResult {
  granted: boolean;
  up: number;
  xp: number;
  rule: string;
}

/**
 * 규칙 코드에 따라 UP/XP를 지급한다.
 * - key: 멱등키 (같은 키는 평생 1회) — 콘텐츠 ID·날짜 기반으로 만들 것
 * - dailyCap: 규칙에 있으면 오늘(KST) 지급 횟수 초과 시 지급하지 않음
 */
export async function award(
  userId: string,
  rule: string,
  key: string,
  opts?: { upOverride?: number; xpOverride?: number; reason?: string },
): Promise<AwardResult> {
  const none: AwardResult = { granted: false, up: 0, xp: 0, rule };
  try {
    const settings = await loadSettings();
    const def = settings.rules[rule];
    if (!def) return none;
    const up = opts?.upOverride ?? def.up;
    const xp = opts?.xpOverride ?? def.xp;
    if (up <= 0 && xp <= 0) return none;

    const admin = createAdminClient();

    if (def.dailyCap && def.dailyCap > 0) {
      const { count, error } = await admin
        .from("reward_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("rule", rule)
        .gte("created_at", kstDayStartIso());
      if (error) return none; // 테이블 없음(마이그레이션 전) 등
      if ((count ?? 0) >= def.dailyCap) return none;
    }

    const { data, error } = await admin.rpc("grant_reward", {
      p_user: userId,
      p_key: key,
      p_rule: rule,
      p_up: up,
      p_xp: xp,
      p_reason: opts?.reason ?? REASON_KO[rule] ?? rule,
    });
    if (error || !data) return none;
    return { granted: true, up, xp, rule };
  } catch {
    return none;
  }
}

// ---------- 스트릭 ----------

export interface StreakState {
  current: number;
  longest: number;
  lastDate: string | null;
  started: string | null;
}

/**
 * 오늘(KST)을 활동일로 반영하고, 도달한 마일스톤 보상을 지급한다.
 * 스트릭 보상 멱등키는 streak:{n}:{시작일} — 한 연속 구간에서 각 1회.
 */
async function touchStreak(
  userId: string,
): Promise<{ state: StreakState; milestone: AwardResult | null }> {
  const admin = createAdminClient();
  const today = kstDate();
  const yesterday = kstDate(-1);

  const { data: row, error } = await admin
    .from("user_streaks")
    .select("current, longest, last_date, started")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  let current: number;
  let started: string;
  if (row?.last_date === today) {
    current = row.current;
    started = row.started ?? today;
  } else if (row?.last_date === yesterday) {
    current = row.current + 1;
    started = row.started ?? yesterday;
  } else {
    current = 1;
    started = today;
  }
  const longest = Math.max(row?.longest ?? 0, current);

  await admin.from("user_streaks").upsert({
    user_id: userId,
    current,
    longest,
    last_date: today,
    started,
    updated_at: new Date().toISOString(),
  });

  let milestone: AwardResult | null = null;
  for (const n of STREAK_MILESTONES) {
    if (current >= n) {
      const res = await award(userId, `streak_${n}`, `streak:${n}:${started}`);
      if (res.granted) milestone = res;
    }
  }
  return { state: { current, longest, lastDate: today, started }, milestone };
}

// ---------- 서프라이즈 보너스 ----------

async function rollSurprise(
  userId: string,
  settings: GamificationSettings,
): Promise<AwardResult | null> {
  const s = settings.surprise;
  if (!s.enabled || s.up <= 0) return null;
  if (Math.random() >= s.chance) return null;
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("reward_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("rule", "surprise")
    .gte("created_at", kstDayStartIso());
  if (error || (count ?? 0) >= s.dailyMax) return null;
  const res = await award(
    userId,
    "surprise",
    `surprise:${kstDate()}:${crypto.randomUUID().slice(0, 8)}`,
    { upOverride: s.up, xpOverride: s.xp },
  );
  return res.granted ? res : null;
}

// ---------- 주간 퀘스트 완료 검사 ----------

async function checkWeeklyQuest(
  userId: string,
  settings: GamificationSettings,
): Promise<AwardResult | null> {
  const admin = createAdminClient();
  const since = kstWeekStartIso();
  const { data, error } = await admin
    .from("activity_events")
    .select("action")
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) return null;
  const counts = new Map<string, number>();
  for (const r of data ?? []) counts.set(r.action, (counts.get(r.action) ?? 0) + 1);
  const allDone = settings.weeklyQuest.every(
    (q) => (counts.get(q.action) ?? 0) >= q.target,
  );
  if (!allDone) return null;
  const res = await award(userId, "weekly_quest", `weekly:${isoWeekKey()}`);
  return res.granted ? res : null;
}

// ---------- 데일리 미션 올클리어 검사 ----------

export function pickDailyMissions(
  settings: GamificationSettings,
  userId: string,
  state: { hasSite: boolean; hasBlog: boolean },
  date = kstDate(),
) {
  const pool = settings.missions.filter((m) => {
    if (m.action === "site_updated" && !state.hasSite) return false;
    if (m.action === "share" && !state.hasBlog && !state.hasSite) return false;
    if (m.action === "blog_published" && !state.hasBlog) return false;
    return true;
  });
  if (pool.length <= 3) return pool;
  // 날짜+유저 기반 결정적 셔플 — 매일 다른 조합, 하루 동안은 고정
  let seed = 0;
  const s = `${userId}:${date}`;
  for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 3);
}

async function checkDailyClear(
  userId: string,
  settings: GamificationSettings,
): Promise<AwardResult | null> {
  const admin = createAdminClient();
  const today = kstDate();
  const [{ data: acts, error }, state] = await Promise.all([
    admin
      .from("activity_events")
      .select("action")
      .eq("user_id", userId)
      .gte("created_at", kstDayStartIso()),
    getUserContentState(userId),
  ]);
  if (error) return null;
  const done = new Set((acts ?? []).map((a) => a.action));
  const missions = pickDailyMissions(settings, userId, state, today);
  if (missions.length === 0 || !missions.every((m) => done.has(m.action)))
    return null;
  const res = await award(userId, "daily_clear", `daily_clear:${today}`);
  return res.granted ? res : null;
}

/** 미션 개인화에 쓰는 최소 상태 */
export async function getUserContentState(
  userId: string,
): Promise<{ hasSite: boolean; hasBlog: boolean }> {
  const admin = createAdminClient();
  const { data: businesses } = await admin
    .from("businesses")
    .select("id")
    .eq("user_id", userId);
  const ids = (businesses ?? []).map((b) => b.id);
  if (ids.length === 0) return { hasSite: false, hasBlog: false };
  const [{ count: sites }, { count: blogs }] = await Promise.all([
    admin
      .from("websites")
      .select("id", { count: "exact", head: true })
      .in("business_id", ids),
    admin
      .from("blog_posts")
      .select("id", { count: "exact", head: true })
      .in("business_id", ids),
  ]);
  return { hasSite: (sites ?? 0) > 0, hasBlog: (blogs ?? 0) > 0 };
}

// ---------- 단일 진입점 ----------

export interface GrowthResult {
  /** 이번 행동으로 실제 지급된 보상들 (UI 토스트용) */
  rewards: AwardResult[];
  streak: StreakState | null;
}

/**
 * 성장 활동 1건 처리: 활동 기록 → 행동 보상 → 스트릭 → 미션/퀘스트 완료 검사
 * → 업적 검사 → 서프라이즈. 모든 단계는 실패해도 던지지 않는다.
 *
 * @param rewardKey 행동 보상의 멱등키 접미(콘텐츠 ID 등). 없으면 날짜 기반.
 */
export async function trackGrowthActivity(
  userId: string,
  action: GrowthAction,
  rewardKey?: string,
): Promise<GrowthResult> {
  const rewards: AwardResult[] = [];
  let streak: StreakState | null = null;
  try {
    const settings = await loadSettings();
    const admin = createAdminClient();

    // 1) 활동 기록 (스트릭·미션·퀘스트·업적의 근거)
    const { error: actErr } = await admin.from("activity_events").insert({
      user_id: userId,
      action,
      ref_id: rewardKey ?? null,
    });
    if (actErr) return { rewards, streak }; // 마이그레이션 전 — 조용히 종료

    // 2) 행동 기본 보상 (blog_edited 등 보상 없는 활동은 rules에 없음)
    if (settings.rules[action]) {
      const key = rewardKey
        ? `${action}:${rewardKey}`
        : `${action}:${kstDate()}`;
      const r = await award(userId, action, key);
      if (r.granted) rewards.push(r);
    }

    // 3) 스트릭
    try {
      const t = await touchStreak(userId);
      streak = t.state;
      if (t.milestone) rewards.push(t.milestone);
    } catch {
      /* 스트릭 실패 무시 */
    }

    // 4) 데일리 미션 올클리어 / 위클리 퀘스트
    const daily = await checkDailyClear(userId, settings);
    if (daily) rewards.push(daily);
    const weekly = await checkWeeklyQuest(userId, settings);
    if (weekly) rewards.push(weekly);

    // 5) 업적
    const achieved = await checkAchievements(userId, action, streak?.current ?? 0);
    rewards.push(...achieved);

    // 6) 서프라이즈
    const lucky = await rollSurprise(userId, settings);
    if (lucky) rewards.push(lucky);
  } catch {
    // 게이미피케이션은 어떤 경우에도 본 기능을 막지 않는다
  }
  return { rewards, streak };
}
