import { createAdminClient } from "@/lib/supabase/server";
import { loadSettings, SETTING_KEYS } from "./config";

/** 관리자 대시보드용 게이미피케이션 통계. */
export interface GrowthStats {
  /** 보상으로 발행된 UP 총량 */
  rewardUpIssued: number;
  /** AI 사용으로 소진된 UP 총량 */
  upSpent: number;
  /** 지급된 보상 이벤트 수 */
  rewardCount: number;
  /** 스트릭 진행 중(오늘/어제 활동) 사용자 수 */
  activeStreaks: number;
  /** 추천 성사 수 */
  referrals: number;
}

export async function getGrowthStatsAdmin(): Promise<GrowthStats> {
  const empty: GrowthStats = {
    rewardUpIssued: 0,
    upSpent: 0,
    rewardCount: 0,
    activeStreaks: 0,
    referrals: 0,
  };
  try {
    const admin = createAdminClient();
    const [rewards, spent, streaks, refs] = await Promise.all([
      admin.from("reward_events").select("up"),
      admin
        .from("point_transactions")
        .select("amount")
        .eq("type", "AI_USAGE"),
      admin
        .from("user_streaks")
        .select("user_id", { count: "exact", head: true })
        .gte("last_date", new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)),
      admin
        .from("referrals")
        .select("referred_user_id", { count: "exact", head: true }),
    ]);
    return {
      rewardUpIssued: (rewards.data ?? []).reduce((s, r) => s + r.up, 0),
      rewardCount: rewards.data?.length ?? 0,
      upSpent: -(spent.data ?? []).reduce((s, r) => s + r.amount, 0),
      activeStreaks: streaks.count ?? 0,
      referrals: refs.count ?? 0,
    };
  } catch {
    return empty;
  }
}

export interface GrowthSettingEntry {
  key: string;
  /** 현재 적용 중인 값(기본값+오버라이드 병합)의 JSON */
  json: string;
  /** DB 오버라이드 존재 여부 */
  overridden: boolean;
}

/** 설정 편집기용 — 현재 적용값과 오버라이드 여부. */
export async function getGrowthSettingsAdmin(): Promise<GrowthSettingEntry[]> {
  const settings = await loadSettings();
  let overriddenKeys = new Set<string>();
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("reward_settings").select("key");
    overriddenKeys = new Set((data ?? []).map((r) => r.key));
  } catch {
    /* 무시 */
  }
  const entries: Array<[string, unknown]> = [
    [SETTING_KEYS.rules, settings.rules],
    [SETTING_KEYS.levels, settings.levels],
    [SETTING_KEYS.missions, settings.missions],
    [SETTING_KEYS.weeklyQuest, settings.weeklyQuest],
    [SETTING_KEYS.scoreWeights, settings.scoreWeights],
    [SETTING_KEYS.surprise, settings.surprise],
  ];
  return entries.map(([key, value]) => ({
    key,
    json: JSON.stringify(value, null, 2),
    overridden: overriddenKeys.has(key),
  }));
}
