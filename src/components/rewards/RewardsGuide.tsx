import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { loadSettings, type RewardRule } from "@/lib/gamification/config";
import { ACHIEVEMENTS } from "@/lib/gamification/achievements";

const fmt = (n: number) => n.toLocaleString("ko-KR");

/** 화면에 노출할 행동 → 라벨 매핑 (금액·횟수는 loadSettings 단일 소스에서). */
const ACTIVITY_LABELS: { key: string; ko: string; en: string }[] = [
  { key: "signup", ko: "회원가입 축하", en: "Sign-up bonus" },
  { key: "brand_profile", ko: "브랜드 스토리 작성", en: "Write your brand story" },
  { key: "site_created", ko: "AI 홈페이지 생성", en: "Create an AI landing page" },
  { key: "site_updated", ko: "홈페이지 내용 업데이트", en: "Update your landing page" },
  { key: "blog_created", ko: "블로그 글 작성", en: "Write a blog post" },
  { key: "blog_published", ko: "블로그 글 발행", en: "Publish a blog post" },
  { key: "card_created", ko: "SNS 카드뉴스 생성", en: "Create SNS card news" },
  { key: "share", ko: "콘텐츠 공유", en: "Share your content" },
];

const STREAK_LABELS: { key: string; ko: string; en: string }[] = [
  { key: "streak_3", ko: "3일 연속 활동", en: "3-day streak" },
  { key: "streak_7", ko: "7일 연속 활동", en: "7-day streak" },
  { key: "streak_14", ko: "14일 연속 활동", en: "14-day streak" },
  { key: "streak_30", ko: "30일 연속 활동", en: "30-day streak" },
  { key: "streak_100", ko: "100일 연속 활동", en: "100-day streak" },
];

const REFERRAL_LABELS: { key: string; ko: string; en: string }[] = [
  { key: "ref_invite", ko: "초대 링크 공유 (최초 1회)", en: "Share your invite link (first time)" },
  { key: "ref_signup", ko: "초대한 친구가 가입", en: "A referred friend signs up" },
  { key: "ref_paid", ko: "초대한 친구가 유료 전환", en: "A referred friend upgrades to paid" },
];

function capText(rule: RewardRule | undefined, ko: boolean): string {
  if (!rule?.dailyCap) return ko ? "제한 없음" : "No limit";
  return ko ? `하루 최대 ${rule.dailyCap}회` : `Up to ${rule.dailyCap}/day`;
}

function RewardTable({
  rows,
  ko,
  showCap = true,
}: {
  rows: { label: string; up: number; cap?: string }[];
  ko: boolean;
  showCap?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="p-4 font-semibold">{ko ? "활동" : "Activity"}</th>
            <th className="p-4 text-right font-semibold">{ko ? "지급 UP" : "UP earned"}</th>
            {showCap && (
              <th className="hidden p-4 text-right font-semibold sm:table-cell">
                {ko ? "적립 한도" : "Limit"}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="p-4 font-medium">{row.label}</td>
              <td className="tnum p-4 text-right font-bold text-primary">
                +{fmt(row.up)} UP
              </td>
              {showCap && (
                <td className="hidden p-4 text-right text-muted sm:table-cell">
                  {row.cap}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * UP 적립 규칙 안내 본문 — 마케팅 페이지(/rewards)와 대시보드(/dashboard/rewards)가 공유.
 * 보상 금액은 loadSettings(코드 기본값 + reward_settings 오버라이드) 단일 소스에서만 온다.
 */
export async function RewardsGuide() {
  const ko = (await getLocale()) === "ko";
  const settings = await loadSettings();
  const r = settings.rules;

  const activityRows = ACTIVITY_LABELS.map((a) => ({
    label: ko ? a.ko : a.en,
    up: r[a.key]?.up ?? 0,
    cap: capText(r[a.key], ko),
  }));

  const missionRows = [
    {
      label: ko ? "데일리 미션 전체 완료" : "Complete all daily missions",
      up: r.daily_clear?.up ?? 0,
      cap: ko ? "하루 1회" : "Once a day",
    },
    {
      label: ko ? "위클리 퀘스트 전체 완료" : "Complete the weekly quest",
      up: r.weekly_quest?.up ?? 0,
      cap: ko ? "주 1회" : "Once a week",
    },
  ];

  const streakRows = STREAK_LABELS.map((s) => ({
    label: ko ? s.ko : s.en,
    up: r[s.key]?.up ?? 0,
  }));

  const referralRows = REFERRAL_LABELS.map((ref) => ({
    label: ko ? ref.ko : ref.en,
    up: r[ref.key]?.up ?? 0,
  }));

  // 업적: UP을 주는 것 우선, 그다음 나머지 (전부 노출)
  const achievements = [...ACHIEVEMENTS].sort((a, b) => b.up - a.up);
  const surprise = settings.surprise;

  return (
    <div className="mx-auto max-w-4xl space-y-14">
      {/* 헤더 */}
      <header className="text-center">
        <p className="eyebrow mb-2 !text-primary">UP REWARDS</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {ko ? "활동하고 UP 받기" : "Earn UP as you go"}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted">
          {ko
            ? "STORYUP에서 콘텐츠를 만들고 공유하고, 친구를 초대하면 UP이 쌓입니다. 쌓인 UP은 월 제공량을 넘는 AI 생성에 사용할 수 있어요."
            : "Create and share content, keep your streak, and invite friends to earn UP. Spend UP on AI generation beyond your monthly quota."}
        </p>
      </header>

      {/* 기본 활동 보상 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {ko ? "기본 활동 보상" : "Activity rewards"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {ko
              ? "콘텐츠를 만들 때마다 UP이 지급됩니다. 반복 악용을 막기 위해 활동별로 하루 적립 한도가 있습니다."
              : "Earn UP every time you create. Each activity has a daily earning limit to prevent abuse."}
          </p>
        </div>
        <RewardTable rows={activityRows} ko={ko} />
      </section>

      {/* 미션 & 퀘스트 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {ko ? "미션 & 퀘스트" : "Missions & quests"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {ko
              ? "매일 주어지는 데일리 미션과 매주 위클리 퀘스트를 모두 달성하면 보너스 UP을 받습니다."
              : "Clear your daily missions and the weekly quest for bonus UP."}
          </p>
        </div>
        <RewardTable rows={missionRows} ko={ko} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm font-bold">
              {ko ? "데일리 미션 (매일 갱신)" : "Daily missions (refreshed daily)"}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {settings.missions.map((m) => (
                <li key={m.code} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{ko ? m.labelKo : m.labelEn}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm font-bold">
              {ko ? "위클리 퀘스트 (매주 갱신)" : "Weekly quest (refreshed weekly)"}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {settings.weeklyQuest.map((q) => (
                <li key={q.action} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{ko ? q.labelKo : q.labelEn}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 연속 출석 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {ko ? "연속 출석 (스트릭)" : "Activity streaks"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {ko
              ? "매일 활동을 이어가면 연속 기록이 쌓이고, 특정 일수를 달성할 때마다 보상을 받습니다."
              : "Keep a daily activity streak and hit milestones for rewards."}
          </p>
        </div>
        <RewardTable rows={streakRows} ko={ko} showCap={false} />
      </section>

      {/* 친구 초대 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {ko ? "친구 초대" : "Refer friends"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {ko
              ? "초대 링크로 친구가 가입하거나 유료 플랜을 시작하면 UP이 지급됩니다."
              : "Earn UP when a friend signs up or upgrades through your invite link."}
          </p>
        </div>
        <RewardTable rows={referralRows} ko={ko} showCap={false} />
      </section>

      {/* 업적 배지 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {ko ? "업적 배지" : "Achievement badges"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {ko
              ? "특정 목표를 처음 달성하면 배지와 함께 UP·XP를 1회 지급합니다."
              : "Unlock a badge and a one-time UP·XP reward for each milestone."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {achievements.map((a) => (
            <div
              key={a.code}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <span className="text-2xl" aria-hidden>
                {a.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{ko ? a.labelKo : a.labelEn}</p>
                <p className="text-xs text-muted">{ko ? a.descKo : a.descEn}</p>
              </div>
              <div className="tnum shrink-0 text-right text-xs font-semibold">
                {a.up > 0 && <p className="text-primary">+{fmt(a.up)} UP</p>}
                <p className="text-muted">+{fmt(a.xp)} XP</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 서프라이즈 보너스 */}
      {surprise.enabled && surprise.up > 0 && (
        <section className="rounded-2xl border border-primary/30 bg-primary-soft p-6">
          <p className="text-sm font-bold text-primary">
            🎁 {ko ? "서프라이즈 보너스" : "Surprise bonus"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {ko
              ? `평소처럼 활동하다 보면 가끔 깜짝 보너스 +${fmt(surprise.up)} UP이 지급됩니다. (구매 불가·확률형 무료 보너스, 하루 최대 ${surprise.dailyMax}회)`
              : `Keep creating and you may randomly receive a surprise +${fmt(surprise.up)} UP (free bonus, not purchasable, up to ${surprise.dailyMax}/day).`}
          </p>
        </section>
      )}

      {/* XP 안내 */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold tracking-tight">
          {ko ? "UP과 XP는 어떻게 다른가요?" : "UP vs XP"}
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>
              {ko
                ? "UP — AI 생성에 사용하는 서비스 이용권입니다. (현금 전환·양도 불가)"
                : "UP — a service credit spent on AI generation. (No cash-out or transfer.)"}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>
              {ko
                ? "XP — 레벨을 올리는 누적 경험치로, 사용·차감되지 않습니다."
                : "XP — cumulative experience that raises your level; it is never spent."}
            </span>
          </li>
        </ul>
      </section>

      {/* 정책 안내 */}
      <p className="text-center text-sm text-muted">
        {ko ? "보상 지급 기준은 사전 고지 후 변경될 수 있습니다. 자세한 내용은 " : "Reward rules may change with prior notice. See the "}
        <Link href="/credit-policy" className="text-primary underline underline-offset-4">
          {ko ? "UP 포인트 정책" : "UP Points Policy"}
        </Link>
        {ko ? "을 확인하세요." : " for details."}
      </p>
    </div>
  );
}
