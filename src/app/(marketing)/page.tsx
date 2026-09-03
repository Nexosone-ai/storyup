import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { HeroDemo } from "@/components/marketing/HeroDemo";
import { ShowcaseTabs } from "@/components/marketing/ShowcaseTabs";
import {
  toSiteItem,
  toPostItem,
  toCardItem,
  markHotPost,
} from "@/components/marketing/showcaseData";
import Link from "next/link";
import { getDict } from "@/lib/i18n";
import {
  getShowcaseSites,
  getShowcasePosts,
  getShowcaseCards,
} from "@/lib/queries";

// www/비-www 이중 주소 중 표준 URL을 선언한다 (metadataBase 기준 절대화).
export const metadata = { alternates: { canonical: "/" } };

export default async function LandingPage() {
  const { t } = await getDict();
  const L = t.landing;
  const [sites, posts, cards] = await Promise.all([
    getShowcaseSites(6),
    getShowcasePosts(6),
    getShowcaseCards(6),
  ]);
  const siteItems = sites.map(toSiteItem);
  const postItems = markHotPost(posts.map(toPostItem), L.showcase.popular);
  const cardItems = cards.map(toCardItem);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <MarketingNav />

      {/* Hero — 좌 네이비 스토리 / 우 라이브 데모 */}
      <section className="grid lg:min-h-[calc(100svh-4rem)] lg:grid-cols-2">
        <div className="band-dark flex flex-col justify-center px-6 py-20 sm:px-12 lg:px-16">
          <span className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90">
            <span className="size-1.5 rounded-full bg-primary" />
            {L.badge}
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-[2.9rem] font-semibold leading-[1.15] tracking-tight sm:text-6xl">
            {L.title1}
            <br />
            {L.title2}
            <br />
            <span className="brand-gradient-text">{L.title3}</span>
            {L.title4}
          </h1>
          <p className="mt-7 max-w-md whitespace-pre-line text-[17px] leading-relaxed text-white/70">
            {L.sub}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="neon-glow inline-flex items-center justify-center rounded-xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {L.cta} →
            </Link>
           {/*} <Link
              href="#how"
              className="inline-flex items-center justify-center rounded-xl border border-white/25 px-7 py-3.5 text-sm font-semibold text-white/90 transition-colors hover:bg-white/5"
            >
              {L.how}
            </Link>*/}
          </div>
          <div className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {L.stats.map((s) => (
              <div key={s.l}>
                <p className="tnum text-2xl font-bold text-white">{s.v}</p>
                <p className="mt-1 text-xs leading-snug text-white/60">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center bg-surface-muted/60 px-6 py-16 sm:px-12">
          <HeroDemo d={L.demo} />
        </div>
      </section>

      {/* How it works — 네이비 밴드 */}
      <section id="how" className="band-dark px-6 py-24 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow mb-3 !text-primary">{L.howEyebrow}</p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-snug sm:text-4xl">
            {L.howT1}
            <br />
            {L.howT2}
          </h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {L.steps.map((s) => (
              <div key={s.n} className="border-t border-white/15 pt-6">
                <p className="brand-gradient-text text-sm font-bold">{s.n}</p>
                <h3 className="mt-3 text-xl font-semibold leading-snug">
                  {s.t}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-white/65">
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — 흰 배경 */}
      <section id="features" className="px-6 py-24 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow mb-3 !text-primary">{L.featEyebrow}</p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-snug sm:text-4xl">
            {L.featT1}
            <br />
            {L.featT2}
          </h2>
          <p className="mt-4 max-w-lg text-muted">{L.featSub}</p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {L.features.map((f) => (
              <div
                key={f.k}
                className="rounded-2xl border border-border bg-surface-muted/70 p-7 transition hover:-translate-y-1 hover:border-primary/40 hover:bg-surface hover:shadow-md"
              >
                <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-primary">
                  {f.k}
                </p>
                <h3 className="mt-3 text-lg font-semibold">{f.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">
                  {f.d}
                </p>
              </div>
            ))}
            <Link
              href="/signup"
              className="bg-primary flex flex-col justify-between rounded-2xl p-7 text-white transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="whitespace-pre-line font-[family-name:var(--font-display)] text-2xl font-semibold leading-snug">
                {L.featCtaT}
              </p>
              <p className="mt-6 inline-flex items-center gap-2 text-sm font-bold">
                {L.featCtaBtn}
                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Showcase — 사용자가 만든 공개 포트폴리오 */}
      <section
        id="showcase"
        className="border-t border-border bg-surface-muted/50 px-6 py-24 sm:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
              {L.showcaseT1}
              <span className="brand-gradient-text-soft">{L.showcaseT2}</span>
            </h2>
            <p className="mt-3 text-muted">{L.showcaseSub}</p>
          </div>
          <ShowcaseTabs
            sites={siteItems}
            posts={postItems}
            cards={cardItems}
            t={L.showcase}
          />
        </div>
      </section>

      {/* Stories — 네이비 밴드 */}
      <section className="band-dark px-6 py-24 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow mb-3 !text-primary">{L.storiesEyebrow}</p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-snug sm:text-4xl">
            {L.storiesT1} <span className="brand-gradient-text-soft">{L.storiesT2}</span>
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {L.testimonials.map((tm) => (
              <figure
                key={tm.name}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-7"
              >
                <blockquote className="text-[15px] leading-relaxed text-white/85">
                  <span className="brand-gradient-text mb-3 block font-[family-name:var(--font-display)] text-3xl leading-none">
                    &ldquo;
                  </span>
                  {tm.quote}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="brand-gradient-bg grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white">
                    {tm.name.slice(0, 1)}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {tm.name}
                    </span>
                    <span className="block text-xs text-white/55">
                      {tm.role}
                    </span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>

          {/* Pricing teaser */}
          <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-2xl border border-white/10 bg-white/5 p-8 md:flex-row md:items-center">
            <div>
              <p className="eyebrow mb-2 !text-primary">{L.pricingEyebrow}</p>
              <h3 className="text-2xl font-semibold">{L.pricingT}</h3>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-white/65">
                {L.pricingSub}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3">
              <Link
                href="/signup"
                className="neon-glow inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {L.pricingBtn}
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
              >
                {L.pricingLink}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA — 블로그 카드와 동일한 파스텔 그라데이션 */}
      <section className="bg-gradient-to-br from-primary/30 via-surface-muted to-accent/20 px-6 py-28 text-center sm:px-8">
        <h2 className="mx-auto max-w-3xl font-[family-name:var(--font-display)] text-4xl font-semibold leading-tight sm:text-5xl">
          {L.ctaTitle1}
          <br />
          {L.ctaTitle2}
        </h2>
        <p className="mx-auto mt-6 max-w-xl whitespace-pre-line text-[17px] leading-relaxed text-muted">
          {L.ctaSub}
        </p>
        <Link
          href="/signup"
          className="neon-glow mt-10 inline-flex rounded-xl bg-primary px-8 py-4 text-sm font-bold text-primary-foreground shadow-lg transition hover:-translate-y-0.5 hover:bg-primary-hover"
        >
          {L.ctaBtn}
        </Link>
        {/*<p className="mt-6 text-sm text-muted">{L.ctaNote}</p>*/}
      </section>

      <Footer />
    </div>
  );
}
