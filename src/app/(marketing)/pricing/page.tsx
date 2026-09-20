import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { getLocale } from "@/lib/i18n";
import { getUser } from "@/lib/queries";
import {
  PLANS,
  CARD_NEWS_PAGES,
  planFeatureList,
  type Plan,
} from "@/lib/plans";
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

export default async function PricingPage() {
  const ko = (await getLocale()) === "ko";
  const tel = `tel:${COMPANY.supportPhone.replace(/-/g, "")}`;
  // 구독은 회원만 가능 — 로그인 상태면 구독 페이지로, 아니면 회원가입으로 유도한다.
  const user = await getUser();
  const subscribeHref = user ? "/dashboard/plans" : "/signup";

  const rows: [string, (p: Plan) => string][] = [
    [ko ? "브랜드 스토리 생성" : "Brand story", () => "✓"],
    [
      ko ? "AI 랜딩페이지" : "AI landing pages",
      (p) => {
        if (p.limits.sites === null) return ko ? "협의" : "Custom";
        const count = ko ? `${p.limits.sites}개` : String(p.limits.sites);
        if (p.siteLayouts == null) return count;
        return ko
          ? `${count} · 레이아웃 ${p.siteLayouts}`
          : `${count} · ${p.siteLayouts} layouts`;
      },
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
      (p) =>
        p.domain === "custom"
          ? ko
            ? "외부 연결"
            : "Custom"
          : p.domain === "subdomain"
            ? ko
              ? "STORYUP 서브"
              : "Subdomain"
            : "–",
    ],
    [
      ko ? "워터마크 제거" : "Watermark removed",
      (p) => (p.watermarkRemoved ? "✓" : "–"),
    ],
    [
      ko ? "블로그 쿠폰 발행" : "Blog coupon block",
      (p) => (p.couponBlock ? "✓" : "–"),
    ],
    [
      ko ? "AI 전략 수립" : "AI strategy",
      (p) => (p.aiStrategy ? "✓" : "–"),
    ],
    [
      ko ? "SEO 최적화" : "SEO optimization",
      (p) => (p.seoTools ? "✓" : "–"),
    ],
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
                ? "무료로 시작하고, 사업이 커지면 월 구독 플랜을 올리세요."
                : "Start free and upgrade your monthly plan as you grow."}
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
                    {planFeatureList(plan, ko).map((f) => (
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
                      <Link
                        href={subscribeHref}
                        className={cn(
                          "inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-colors",
                          popular
                            ? "neon-glow bg-primary text-primary-foreground hover:bg-primary-hover"
                            : "border border-border hover:border-primary/60 hover:text-primary",
                        )}
                      >
                        {ko ? "구독하기" : "Subscribe"}
                      </Link>
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
