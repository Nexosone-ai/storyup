import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { getPerformanceReport, type ReportPeriod } from "@/lib/report";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export const metadata = { title: "성과 리포트" };

function GrowthBadge({ pct, ko }: { pct: number; ko: boolean }) {
  if (!Number.isFinite(pct) || pct === 0)
    return <span className="text-xs font-medium text-muted">–</span>;
  const up = pct > 0;
  return (
    <span
      className={`text-xs font-semibold ${up ? "text-success" : "text-danger"}`}
      title={ko ? "직전 동일 기간 대비" : "vs. previous period"}
    >
      {up ? "▲" : "▼"} {Math.abs(Math.round(pct))}%
    </span>
  );
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const ko = (await getLocale()) === "ko";
  const plan = getPlanById(await getPlanId(user.id));
  const { period: periodParam } = await searchParams;

  // Free 등 리포트 미제공 플랜 — 업그레이드 안내.
  if (!plan.report) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "성과 리포트" : "Performance report"}
        </h1>
        <Card className="flex flex-col items-start gap-3 p-8">
          <p className="text-lg font-semibold">
            {ko
              ? "성과 리포트는 Basic 이상 플랜에서 제공돼요."
              : "Reports are available on Basic and higher."}
          </p>
          <p className="text-sm text-muted">
            {ko
              ? "방문·문의(리드)·콘텐츠 발행 지표를 기간별로 한눈에 확인하고, 직전 기간과 비교해 성장세를 파악할 수 있어요. Basic은 월간, Pro는 주간까지 제공됩니다."
              : "Track visits, leads, and publishing over time and compare with the previous period. Basic includes monthly; Pro adds weekly."}
          </p>
          <ButtonLink href="/dashboard/plans">
            {ko ? "플랜 업그레이드" : "Upgrade plan"}
          </ButtonLink>
        </Card>
      </div>
    );
  }

  // 사용 가능한 기간: Basic=월간, Pro/Partner=주간+월간.
  const canWeekly = plan.report === "weekly";
  let period: ReportPeriod =
    periodParam === "week" || periodParam === "month"
      ? (periodParam as ReportPeriod)
      : canWeekly
        ? "week"
        : "month";
  if (period === "week" && !canWeekly) period = "month"; // 권한 없는 기간 방지

  const report = await getPerformanceReport(user.id, period);

  const periodLabel =
    period === "week"
      ? ko
        ? "최근 7일"
        : "Last 7 days"
      : ko
        ? "최근 30일"
        : "Last 30 days";

  const cards: { label: string; value: number; metric: (typeof report)["visits"] }[] =
    [
      {
        label: ko ? "방문" : "Visits",
        value: report.visits.current,
        metric: report.visits,
      },
      {
        label: ko ? "문의·쿠폰(리드)" : "Leads",
        value: report.leads.current,
        metric: report.leads,
      },
      {
        label: ko ? "블로그 발행" : "Posts published",
        value: report.blogPublished.current,
        metric: report.blogPublished,
      },
    ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "성과 리포트" : "Performance report"}
        </h1>
        {/* 기간 탭 — 주간은 Pro 전용 */}
        <div className="inline-flex rounded-xl border border-border bg-surface p-1 text-sm">
          {canWeekly && (
            <Link
              href="/dashboard/report?period=week"
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                period === "week"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {ko ? "주간" : "Weekly"}
            </Link>
          )}
          <Link
            href="/dashboard/report?period=month"
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              period === "month"
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {ko ? "월간" : "Monthly"}
          </Link>
        </div>
      </div>

      <p className="text-sm text-muted">
        {ko
          ? `${periodLabel} · 사업장 ${report.businesses}곳 합산 · 직전 동일 기간 대비 증감`
          : `${periodLabel} · across ${report.businesses} business(es) · change vs. previous period`}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-sm text-muted">{c.label}</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="tnum text-3xl font-bold">
                {c.value.toLocaleString()}
              </p>
              <GrowthBadge pct={c.metric.growthPct} ko={ko} />
            </div>
            <p className="mt-1 text-xs text-muted">
              {ko
                ? `직전 기간 ${c.metric.previous.toLocaleString()}`
                : `Previous ${c.metric.previous.toLocaleString()}`}
            </p>
          </Card>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted">
        {ko
          ? "방문은 공개 사이트·블로그 페이지뷰, 리드는 남겨진 문의와 쿠폰 수령 수, 블로그 발행은 해당 기간에 공개된 글 수입니다."
          : "Visits are public page views, leads are inquiries and coupon claims, and posts are those published in the period."}
      </p>
    </div>
  );
}
