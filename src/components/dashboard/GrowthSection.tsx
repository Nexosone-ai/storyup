import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import type { GrowthOverview } from "@/lib/gamification/overview";
import { ReferralCard } from "./ReferralCard";

/** 보상 규칙 → 표시 라벨 */
const RULE_LABELS: Record<string, { ko: string; en: string }> = {
  signup: { ko: "가입 축하 보너스", en: "Welcome bonus" },
  brand_profile: { ko: "브랜드 프로필 완성", en: "Brand profile completed" },
  site_created: { ko: "홈페이지 생성", en: "Landing page created" },
  site_updated: { ko: "홈페이지 업데이트", en: "Landing page updated" },
  blog_created: { ko: "블로그 작성", en: "Blog post written" },
  blog_published: { ko: "블로그 발행", en: "Blog post published" },
  card_created: { ko: "카드뉴스 생성", en: "Card news created" },
  share: { ko: "콘텐츠 공유", en: "Content shared" },
  ref_invite: { ko: "친구 초대 시작", en: "Invite started" },
  ref_signup: { ko: "친구 가입 완료", en: "Friend signed up" },
  ref_paid: { ko: "추천 유료 전환", en: "Referral upgraded" },
  daily_clear: { ko: "데일리 미션 올클리어", en: "Daily missions cleared" },
  weekly_quest: { ko: "위클리 퀘스트 완료", en: "Weekly quest complete" },
  streak_3: { ko: "3일 연속 활동", en: "3-day streak" },
  streak_7: { ko: "7일 연속 활동", en: "7-day streak" },
  streak_14: { ko: "14일 연속 활동", en: "14-day streak" },
  streak_30: { ko: "30일 연속 활동", en: "30-day streak" },
  streak_100: { ko: "100일 연속 활동", en: "100-day streak" },
  achievement: { ko: "업적 달성", en: "Achievement unlocked" },
  surprise: { ko: "🎁 서프라이즈 보너스", en: "🎁 Surprise bonus" },
};

function Bar({ pct, tall }: { pct: number; tall?: boolean }) {
  return (
    <div
      className={`${tall ? "h-2" : "h-1.5"} w-full overflow-hidden rounded-full bg-surface-muted`}
    >
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function fmtDate(iso: string, ko: boolean) {
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

export function GrowthSection({
  g,
  ko,
}: {
  g: GrowthOverview;
  ko: boolean;
}) {
  const label = (rule: string) =>
    (ko ? RULE_LABELS[rule]?.ko : RULE_LABELS[rule]?.en) ?? rule;
  const doneMissions = g.missions.filter((m) => m.done).length;
  const weeklyDone = g.weekly.filter((q) => q.done >= q.target).length;
  const achieved = g.achievements.filter((a) => a.achieved);

  return (
    <div className="space-y-6">
      {/* ---- 상단 상태 스트립 ---- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="space-y-1">
          <p className="eyebrow">Story Streak</p>
          <p className="text-2xl font-bold tracking-tight">
            🔥 {g.streak.current}
            <span className="ml-1 text-sm font-medium text-muted">
              {ko ? "일 연속" : "days"}
            </span>
          </p>
          <p className="text-xs text-muted">
            {ko ? `최고 기록 ${g.streak.longest}일` : `Best: ${g.streak.longest} days`}
          </p>
        </Card>
        <Card className="space-y-1">
          <p className="eyebrow">Story Score</p>
          <p className="tnum text-2xl font-bold tracking-tight">
            {g.score.previous !== null && g.score.previous !== g.score.score && (
              <span className="mr-1.5 text-sm font-medium text-muted line-through">
                {g.score.previous}
              </span>
            )}
            {g.score.score}
            <span className="text-sm font-medium text-muted"> / 100</span>
          </p>
          <Bar pct={g.score.score} />
        </Card>
        <Card className="space-y-1">
          <p className="eyebrow">UP</p>
          <p className="tnum text-2xl font-bold tracking-tight">
            🪙 {g.balance.toLocaleString()}
            <span className="ml-1 text-sm font-medium text-muted">UP</span>
          </p>
          <Link
            href="/dashboard/points"
            className="text-xs font-medium text-primary hover:underline"
          >
            {ko ? "UP 지갑 보기 →" : "Open UP wallet →"}
          </Link>
        </Card>
        <Card className="space-y-1">
          <p className="eyebrow">Level</p>
          <p className="text-2xl font-bold tracking-tight">
            ⭐ {g.level.name}
          </p>
          <Bar pct={g.level.progress} />
          <p className="tnum text-xs text-muted">
            {g.level.nextAt === null
              ? ko
                ? `${g.xp.toLocaleString()} XP · 최고 레벨`
                : `${g.xp.toLocaleString()} XP · Max level`
              : ko
                ? `${g.xp.toLocaleString()} XP · ${g.level.nextName}까지 ${(g.level.nextAt - g.xp).toLocaleString()} XP`
                : `${g.xp.toLocaleString()} XP · ${(g.level.nextAt - g.xp).toLocaleString()} XP to ${g.level.nextName}`}
          </p>
        </Card>
      </div>

      {/* ---- AI Next Action ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft/60 p-5">
        <div className="min-w-0">
          <p className="eyebrow mb-1 text-primary">Next Action</p>
          <p className="text-sm font-medium">
            {ko ? g.nextAction.textKo : g.nextAction.textEn}
          </p>
        </div>
        <ButtonLink href={g.nextAction.href} size="sm">
          {ko ? g.nextAction.ctaKo : g.nextAction.ctaEn}
        </ButtonLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- 데일리 미션 ---- */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold tracking-tight">
              {ko ? "오늘의 StoryUp 미션" : "Today's StoryUp Missions"}
            </h3>
            <span className="tnum text-sm text-muted">
              {doneMissions} / {g.missions.length}
            </span>
          </div>
          <ul className="space-y-2.5">
            {g.missions.map((m) => (
              <li
                key={m.code}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                  m.done
                    ? "border-primary/40 bg-primary-soft/50"
                    : "border-border bg-surface"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5 text-sm">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      m.done
                        ? "bg-primary text-primary-foreground"
                        : "border border-border-strong text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className={m.done ? "line-through opacity-70" : ""}>
                    {ko ? m.labelKo : m.labelEn}
                  </span>
                </span>
                <span className="tnum shrink-0 text-xs font-medium text-primary">
                  +{m.reward.up} UP / +{m.reward.xp} XP
                </span>
              </li>
            ))}
          </ul>
          <div
            className={`rounded-xl p-3 text-center text-sm font-semibold ${
              g.dailyCleared
                ? "bg-primary text-primary-foreground"
                : "bg-surface-muted text-muted"
            }`}
          >
            {g.dailyCleared
              ? ko
                ? `🎉 ALL CLEAR! +${g.dailyClearReward.up} UP 지급 완료`
                : `🎉 ALL CLEAR! +${g.dailyClearReward.up} UP granted`
              : ko
                ? `ALL CLEAR 보너스 +${g.dailyClearReward.up} UP`
                : `All-clear bonus +${g.dailyClearReward.up} UP`}
          </div>
        </Card>

        {/* ---- 위클리 퀘스트 ---- */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold tracking-tight">
              🚀 {ko ? "이번 주 Story Quest" : "This Week's Story Quest"}
            </h3>
            <span className="tnum text-sm text-muted">
              {weeklyDone} / {g.weekly.length}
            </span>
          </div>
          <ul className="space-y-3">
            {g.weekly.map((q) => (
              <li key={q.action}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className={q.done >= q.target ? "opacity-70" : ""}>
                    {q.done >= q.target ? "✅ " : ""}
                    {ko ? q.labelKo : q.labelEn}
                  </span>
                  <span className="tnum text-xs text-muted">
                    {q.done} / {q.target}
                  </span>
                </div>
                <Bar pct={(q.done / q.target) * 100} />
              </li>
            ))}
          </ul>
          <div
            className={`rounded-xl p-3 text-center text-sm font-semibold ${
              g.weeklyCleared
                ? "bg-primary text-primary-foreground"
                : "bg-surface-muted text-muted"
            }`}
          >
            🎁{" "}
            {g.weeklyCleared
              ? ko
                ? `WEEKLY BONUS +${g.weeklyReward.up} UP / +${g.weeklyReward.xp} XP 지급 완료`
                : `WEEKLY BONUS +${g.weeklyReward.up} UP / +${g.weeklyReward.xp} XP granted`
              : `WEEKLY BONUS +${g.weeklyReward.up} UP / +${g.weeklyReward.xp} XP`}
          </div>
        </Card>

        {/* ---- Story Score 분해 ---- */}
        <Card className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold tracking-tight">Story Score</h3>
            <p className="tnum text-lg font-bold">
              {g.score.score}
              <span className="text-sm font-medium text-muted"> / 100</span>
            </p>
          </div>
          <ul className="space-y-3">
            {g.score.parts.map((p) => (
              <li key={p.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{ko ? p.labelKo : p.labelEn}</span>
                  <span className="tnum text-xs text-muted">{p.pct}%</span>
                </div>
                <Bar pct={p.pct} />
              </li>
            ))}
          </ul>
          {g.search && (
            <p className="tnum text-xs text-muted">
              🌐{" "}
              {ko
                ? `Google 검색 노출 ${g.search.impressions.toLocaleString()}회 · 검색 유입 ${g.search.clicks.toLocaleString()}회`
                : `Google impressions ${g.search.impressions.toLocaleString()} · clicks ${g.search.clicks.toLocaleString()}`}
            </p>
          )}
        </Card>

        {/* ---- 업적 ---- */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold tracking-tight">
              {ko ? "업적" : "Achievements"}
            </h3>
            <span className="tnum text-sm text-muted">
              {achieved.length} / {g.achievements.length}
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {g.achievements.map((a) => (
              <li
                key={a.code}
                title={ko ? a.descKo : a.descEn}
                className={`rounded-xl border p-3 text-center ${
                  a.achieved
                    ? "border-primary/40 bg-primary-soft/50"
                    : "border-border bg-surface opacity-45 grayscale"
                }`}
              >
                <p className="text-xl">{a.emoji}</p>
                <p className="mt-1 truncate text-xs font-semibold">
                  {ko ? a.labelKo : a.labelEn}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">
                  {ko ? a.descKo : a.descEn}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        {/* ---- 최근 UP 내역 ---- */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold tracking-tight">
              {ko ? "최근 획득한 보상" : "Recent rewards"}
            </h3>
            <Link
              href="/dashboard/points"
              className="text-xs font-medium text-primary hover:underline"
            >
              {ko ? "전체 내역 →" : "All history →"}
            </Link>
          </div>
          {g.recentRewards.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
              {ko
                ? "아직 보상이 없어요. 오늘의 미션부터 시작해보세요!"
                : "No rewards yet — start with today's missions!"}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {g.recentRewards.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{label(r.rule)}</p>
                    <p className="text-xs text-muted">
                      {fmtDate(r.created_at, ko)}
                    </p>
                  </div>
                  <p className="tnum shrink-0 text-sm font-semibold text-primary">
                    {r.up > 0 && `+${r.up.toLocaleString()} UP`}
                    {r.up > 0 && r.xp > 0 && " · "}
                    {r.xp > 0 && `+${r.xp.toLocaleString()} XP`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ---- 추천 ---- */}
        <ReferralCard
          code={g.referral.code}
          invitedCount={g.referral.invitedCount}
          inviteRewarded={g.referral.inviteRewarded}
        />
      </div>
    </div>
  );
}
