import { createAdminClient } from "@/lib/supabase/server";

/**
 * 게이미피케이션 정책 — 기본값은 코드에, 운영 조정값은 reward_settings(key→jsonb)에.
 * DB 값이 있으면 키 단위로 기본값을 덮어쓴다 (마이그레이션 전에는 기본값으로 동작).
 */

export interface RewardRule {
  /** 지급 UP (기존 포인트 원장과 동일 화폐) */
  up: number;
  /** 지급 XP (소비 불가 누적치) */
  xp: number;
  /** 하루 최대 지급 횟수 (삭제 후 재생성 등 반복 악용 방지). 없으면 무제한 */
  dailyCap?: number;
}

/** 행동별 보상 규칙 기본값 */
export const DEFAULT_RULES: Record<string, RewardRule> = {
  signup: { up: 300, xp: 100 },
  brand_profile: { up: 100, xp: 100, dailyCap: 2 },
  site_created: { up: 200, xp: 200, dailyCap: 2 },
  site_updated: { up: 20, xp: 30, dailyCap: 1 },
  blog_created: { up: 30, xp: 50, dailyCap: 3 },
  blog_published: { up: 50, xp: 80, dailyCap: 3 },
  card_created: { up: 20, xp: 30, dailyCap: 3 },
  share: { up: 30, xp: 20, dailyCap: 2 },
  ref_invite: { up: 100, xp: 50 }, // 초대 링크 최초 복사 1회 (발송 검증 불가 → 1회 한정)
  ref_signup: { up: 300, xp: 300 },
  ref_paid: { up: 1000, xp: 500 },
  daily_clear: { up: 100, xp: 100 },
  weekly_quest: { up: 500, xp: 500 },
  streak_3: { up: 50, xp: 50 },
  streak_7: { up: 100, xp: 100 },
  streak_14: { up: 200, xp: 200 },
  streak_30: { up: 500, xp: 500 },
  streak_100: { up: 1000, xp: 1000 },
  achievement: { up: 0, xp: 100 }, // 업적 공통 기본 (개별 업적이 오버라이드)
  surprise: { up: 300, xp: 0 },
};

export interface LevelDef {
  xp: number;
  name: string;
}

/** XP 레벨 기준 (오름차순) */
export const DEFAULT_LEVELS: LevelDef[] = [
  { xp: 0, name: "Starter" },
  { xp: 1000, name: "Creator" },
  { xp: 3000, name: "Storyteller" },
  { xp: 10000, name: "Builder" },
  { xp: 30000, name: "Influencer" },
  { xp: 100000, name: "Story Master" },
];

export interface MissionDef {
  code: string;
  /** activity_events.action — 이 행동이 오늘 1회 이상이면 완료 */
  action: string;
  labelKo: string;
  labelEn: string;
  /** 표시용 보상 (실지급은 행동 기본 보상 = DEFAULT_RULES[action]) */
  rewardRule: string;
}

/** 데일리 미션 풀 — 사용자 상태에 따라 매일 2~3개 선택 */
export const DEFAULT_MISSIONS: MissionDef[] = [
  { code: "m_blog", action: "blog_created", labelKo: "블로그 1개 작성", labelEn: "Write 1 blog post", rewardRule: "blog_created" },
  { code: "m_publish", action: "blog_published", labelKo: "블로그 1개 발행", labelEn: "Publish 1 blog post", rewardRule: "blog_published" },
  { code: "m_card", action: "card_created", labelKo: "SNS 카드뉴스 1개 생성", labelEn: "Create 1 card news set", rewardRule: "card_created" },
  { code: "m_site", action: "site_updated", labelKo: "홈페이지 내용 업데이트", labelEn: "Update your landing page", rewardRule: "site_updated" },
  { code: "m_share", action: "share", labelKo: "콘텐츠 1회 공유", labelEn: "Share your content once", rewardRule: "share" },
];

export interface QuestItemDef {
  action: string;
  target: number;
  labelKo: string;
  labelEn: string;
}

/** 위클리 퀘스트 (ISO 주 단위, 전부 달성 시 weekly_quest 보상) */
export const DEFAULT_WEEKLY_QUEST: QuestItemDef[] = [
  { action: "blog_published", target: 3, labelKo: "블로그 3개 발행", labelEn: "Publish 3 blog posts" },
  { action: "card_created", target: 5, labelKo: "SNS 카드뉴스 5개 생성", labelEn: "Create 5 card news sets" },
  { action: "site_updated", target: 1, labelKo: "홈페이지 1회 업데이트", labelEn: "Update landing page once" },
  { action: "share", target: 3, labelKo: "콘텐츠 3회 공유", labelEn: "Share content 3 times" },
];

/** Story Score 가중치 (합계 100) */
export const DEFAULT_SCORE_WEIGHTS = {
  brand: 20,
  website: 20,
  blog: 20,
  sns: 15,
  share: 10,
  seo: 15,
};

/** 서프라이즈 보너스 — 무료 활동에 대한 확률 보너스 (도박성 아님, 구매 불가) */
export const DEFAULT_SURPRISE = {
  enabled: true,
  /** 활동 1건당 당첨 확률 (0~1) */
  chance: 0.03,
  up: 300,
  xp: 0,
  /** 1인당 하루 최대 당첨 횟수 */
  dailyMax: 1,
};

export const STREAK_MILESTONES = [3, 7, 14, 30, 100] as const;

export interface GamificationSettings {
  rules: Record<string, RewardRule>;
  levels: LevelDef[];
  missions: MissionDef[];
  weeklyQuest: QuestItemDef[];
  scoreWeights: typeof DEFAULT_SCORE_WEIGHTS;
  surprise: typeof DEFAULT_SURPRISE;
}

export const DEFAULT_SETTINGS: GamificationSettings = {
  rules: DEFAULT_RULES,
  levels: DEFAULT_LEVELS,
  missions: DEFAULT_MISSIONS,
  weeklyQuest: DEFAULT_WEEKLY_QUEST,
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
  surprise: DEFAULT_SURPRISE,
};

/** reward_settings의 key ↔ 설정 필드 매핑 */
export const SETTING_KEYS = {
  rules: "rules",
  levels: "levels",
  missions: "missions",
  weeklyQuest: "weekly_quest",
  scoreWeights: "score_weights",
  surprise: "surprise",
} as const;

let cache: { at: number; value: GamificationSettings } | null = null;
const CACHE_MS = 60_000;

/** DB 오버라이드를 병합한 현재 정책. 실패(마이그레이션 전 등) 시 기본값. */
export async function loadSettings(): Promise<GamificationSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const merged: GamificationSettings = structuredClone(DEFAULT_SETTINGS);
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("reward_settings").select("key, value");
    for (const row of data ?? []) {
      const v = row.value as unknown;
      if (!v) continue;
      switch (row.key) {
        case SETTING_KEYS.rules:
          // 규칙은 코드 기본값 위에 키 단위 병합 (새 규칙이 코드에 추가돼도 유지)
          merged.rules = { ...merged.rules, ...(v as Record<string, RewardRule>) };
          break;
        case SETTING_KEYS.levels:
          if (Array.isArray(v) && v.length) merged.levels = v as LevelDef[];
          break;
        case SETTING_KEYS.missions:
          if (Array.isArray(v) && v.length) merged.missions = v as MissionDef[];
          break;
        case SETTING_KEYS.weeklyQuest:
          if (Array.isArray(v) && v.length) merged.weeklyQuest = v as QuestItemDef[];
          break;
        case SETTING_KEYS.scoreWeights:
          merged.scoreWeights = { ...merged.scoreWeights, ...(v as object) };
          break;
        case SETTING_KEYS.surprise:
          merged.surprise = { ...merged.surprise, ...(v as object) };
          break;
      }
    }
  } catch {
    // 설정 테이블이 아직 없으면 기본값으로 동작
  }
  cache = { at: Date.now(), value: merged };
  return merged;
}

/** Admin 저장 직후 등 캐시 무효화 */
export function invalidateSettingsCache() {
  cache = null;
}

// ---------- 레벨 계산 ----------

export interface LevelInfo {
  level: number; // 1부터
  name: string;
  xp: number;
  currentFloor: number;
  /** 다음 레벨 기준 XP. null = 최고 레벨 */
  nextAt: number | null;
  nextName: string | null;
  /** 현재 구간 진행률 0~100 */
  progress: number;
}

export function levelForXp(xp: number, levels: LevelDef[]): LevelInfo {
  const sorted = [...levels].sort((a, b) => a.xp - b.xp);
  let idx = 0;
  for (let i = 0; i < sorted.length; i++) if (xp >= sorted[i].xp) idx = i;
  const cur = sorted[idx];
  const next = sorted[idx + 1] ?? null;
  const progress = next
    ? Math.min(100, Math.round(((xp - cur.xp) / (next.xp - cur.xp)) * 100))
    : 100;
  return {
    level: idx + 1,
    name: cur.name,
    xp,
    currentFloor: cur.xp,
    nextAt: next?.xp ?? null,
    nextName: next?.name ?? null,
    progress,
  };
}
