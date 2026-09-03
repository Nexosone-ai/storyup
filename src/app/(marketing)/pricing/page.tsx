import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { getLocale } from "@/lib/i18n";
import { PLANS, OVERAGE_COST, CARD_NEWS_PAGES, type Plan } from "@/lib/plans";
import { COMPANY } from "@/lib/company";
import { cn } from "@/utils/cn";

export const metadata = {
  title: "요금제",
  alternates: { canonical: "/pricing" },
};

const fmt = (n: number) => n.toLocaleString("ko-KR");

function planPrice(plan: Plan, ko: boolean) {
  if (plan.priceKrw === null) return ko ? "별도 협의" : "Custom";
  if (plan.priceKrw === 0) return ko ? "무료" : "Free";
  return `₩${fmt(plan.priceKrw)}`;
}

function planFeatures(plan: Plan, ko: boolean): string[] {
  const l = plan.limits;
  const per = ko ? "건/월" : "/mo";
  const talk = ko ? "협의" : "Custom";
  return [
    plan.monthlyPoints === null
      ? ko
        ? "포인트 대량 제공"
        : "Bulk points included"
      : ko
        ? `매월 ${fmt(plan.monthlyPoints)}P 제공`
        : `${fmt(plan.monthlyPoints)}P every month`,
    ko ? "브랜드 스토리 생성" : "Brand story generation",
    l.sites === null
      ? ko
        ? `AI 홈페이지 ${talk}`
        : `AI websites: ${talk}`
      : ko
        ? `AI 홈페이지 ${l.sites}개`
        : `${l.sites} AI website${l.sites > 1 ? "s" : ""}`,
    l.blogPosts === null
      ? ko
        ? `블로그 생성 ${talk}`
        : `Blog posts: ${talk}`
      : ko
        ? `블로그 생성 ${l.blogPosts}${per}`
        : `${l.blogPosts} blog posts${per}`,
    l.cardNews === null
      ? ko
        ? `SNS 카드뉴스 ${talk}`
        : `Card news: ${talk}`
      : ko
        ? `SNS 카드뉴스(${CARD_NEWS_PAGES}매) ${l.cardNews}${per}`
        : `${l.cardNews} card news (${CARD_NEWS_PAGES} pages)${per}`,
    l.aiImages === null
      ? ko
        ? `AI 이미지 ${talk}`
        : `AI images: ${talk}`
      : l.aiImages === 0
        ? ko
          ? "무료 이미지 모델 제공"
          : "Free image model included"
        : ko
          ? `AI 이미지 ${l.aiImages}개/월`
          : `${l.aiImages} AI images/mo`,
    ...(plan.customDomain
      ? [ko ? "자체 도메인 연결" : "Custom domain"]
      : []),
    ...(plan.watermarkRemoved
      ? [ko ? "STORYUP 워터마크 제거" : "No STORYUP watermark"]
      : []),
  ];
}

export default async function PricingPage() {
  const ko = (await getLocale()) === "ko";
  const tel = `tel:${COMPANY.supportPhone.replace(/-/g, "")}`;

  const rows: [string, (p: Plan) => string][] = [
    [
      ko ? "월 제공 포인트" : "Monthly points",
      (p) =>
        p.monthlyPoints === null
          ? ko
            ? "대량 제공"
            : "Bulk"
          : `${fmt(p.monthlyPoints)}P`,
    ],
    [ko ? "브랜드 스토리 생성" : "Brand story", () => "✓"],
    [
      ko ? "AI 홈페이지" : "AI websites",
      (p) =>
        p.limits.sites === null
          ? ko
            ? "협의"
            : "Custom"
          : ko
            ? `${p.limits.sites}개`
            : String(p.limits.sites),
    ],
    [
      ko ? "블로그 생성" : "Blog posts",
      (p) =>
        p.limits.blogPosts === null
          ? ko
            ? "협의"
            : "Custom"
          : ko
            ? `${p.limits.blogPosts}건/월`
            : `${p.limits.blogPosts}/mo`,
    ],
    [
      ko
        ? `SNS 카드뉴스 (${CARD_NEWS_PAGES}매)`
        : `Card news (${CARD_NEWS_PAGES} pages)`,
      (p) =>
        p.limits.cardNews === null
          ? ko
            ? "협의"
            : "Custom"
          : ko
            ? `${p.limits.cardNews}건/월`
            : `${p.limits.cardNews}/mo`,
    ],
    [
      ko ? "AI 이미지" : "AI images",
      (p) =>
        p.limits.aiImages === null
          ? ko
            ? "협의"
            : "Custom"
          : p.limits.aiImages === 0
            ? ko
              ? "무료 모델"
              : "Free model"
            : ko
              ? `${p.limits.aiImages}개/월`
              : `${p.limits.aiImages}/mo`,
    ],
    [
      ko ? "자체 도메인" : "Custom domain",
      (p) => (p.customDomain ? "✓" : "–"),
    ],
    [
      ko ? "워터마크 제거" : "Watermark removed",
      (p) => (p.watermarkRemoved ? "✓" : "–"),
    ],
  ];

  const overages: [string, number][] = [
    [ko ? "AI 홈페이지" : "AI website", OVERAGE_COST.site],
    [ko ? "블로그 생성" : "Blog post", OVERAGE_COST.blogPost],
    [ko ? "SNS 카드뉴스" : "Card news", OVERAGE_COST.cardNews],
    [ko ? "AI 이미지" : "AI image", OVERAGE_COST.aiImage],
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="flex-1 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="eyebrow mb-2 !text-primary">PRICING</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {ko ? "필요한 만큼만, 부담 없이" : "Pay for what you need"}
            </h1>
            <p className="mt-3 text-muted">
              {ko
                ? "무료로 시작하고, 사업이 커지면 플랜을 올리세요. 월 제공량을 넘으면 포인트로 추가 생성할 수 있습니다."
                : "Start free and upgrade as you grow. Past your monthly quota, keep creating with points."}
            </p>
          </div>

          {/* 플랜 카드 */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => {
              const popular = plan.id === "pro";
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-surface p-6",
                    popular
                      ? "border-primary shadow-lg shadow-primary/10"
                      : "border-border",
                  )}
                >
                  {popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                      {ko ? "인기" : "Popular"}
                    </span>
                  )}
                  <p className="text-sm font-bold uppercase tracking-[0.15em] text-muted">
                    {ko ? plan.name.ko : plan.name.en}
                  </p>
                  <p className="tnum mt-3 text-3xl font-bold">
                    {planPrice(plan, ko)}
                    {plan.priceKrw ? (
                      <span className="text-sm font-medium text-muted">
                        {ko ? " /월" : " /mo"}
                      </span>
                    ) : null}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                    {planFeatures(plan, ko).map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-primary">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    {plan.id === "free" ? (
                      <Link
                        href="/signup"
                        className="neon-glow inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                      >
                        {ko ? "무료로 시작하기" : "Start free"}
                      </Link>
                    ) : plan.id === "partner" ? (
                      <a
                        href={tel}
                        className="inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition-colors hover:border-primary/60 hover:text-primary"
                      >
                        {ko ? "문의하기" : "Contact us"}
                      </a>
                    ) : (
                      <span className="inline-flex w-full cursor-default items-center justify-center rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-bold text-muted">
                        {ko ? "출시 준비 중" : "Coming soon"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 비교 표 */}
          <div className="mt-16 overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-4 text-left font-semibold">
                    {ko ? "제공 내용" : "Features"}
                  </th>
                  {PLANS.map((p) => (
                    <th key={p.id} className="p-4 text-center font-semibold">
                      <span className="block">{ko ? p.name.ko : p.name.en}</span>
                      <span className="tnum mt-0.5 block text-xs font-medium text-muted">
                        {planPrice(p, ko)}
                        {p.priceKrw ? (ko ? "/월" : "/mo") : ""}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(([label, cell]) => (
                  <tr key={label}>
                    <td className="p-4 font-medium">{label}</td>
                    {PLANS.map((p) => (
                      <td key={p.id} className="tnum p-4 text-center">
                        {cell(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 초과 사용 안내 */}
          <div className="mt-10 rounded-2xl border border-border bg-surface-muted p-6 sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight">
              {ko ? "월 제공량을 넘으면?" : "Past your monthly quota?"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {ko
                ? "포인트로 필요한 만큼 추가 생성할 수 있습니다. 1P = ₩1이며, 미사용 포인트는 다음 달로 이월됩니다."
                : "Keep creating with points — 1P = ₩1, and unused points roll over to the next month."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {overages.map(([label, cost]) => (
                <div
                  key={label}
                  className="rounded-xl border border-border bg-surface p-4 text-center"
                >
                  <p className="text-xs text-muted">{label}</p>
                  <p className="tnum mt-1 font-bold">
                    {fmt(cost)}P
                    <span className="text-xs font-medium text-muted">
                      {ko ? " /건" : " each"}
                    </span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              {ko ? (
                <>
                  자세한 포인트 규정은{" "}
                  <Link href="/credit-policy" className="text-primary underline underline-offset-4">
                    크레딧 정책
                  </Link>
                  을 확인하세요.
                </>
              ) : (
                <>
                  See the{" "}
                  <Link href="/credit-policy" className="text-primary underline underline-offset-4">
                    credit policy
                  </Link>{" "}
                  for details.
                </>
              )}
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
