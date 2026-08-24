import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import Link from "next/link";
import { getDict } from "@/lib/i18n";

const FEATURE_ICONS = [Icon.sparkles, Icon.globe, Icon.pen];

export default async function LandingPage() {
  const { t } = await getDict();
  const L = t.landing;

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-20 pb-20 sm:px-8 sm:pt-28">
        <div className="max-w-3xl">
          <p className="eyebrow mb-5">{L.eyebrow}</p>
          <h1 className="text-[2.75rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {L.title1}
            <br />
            <span className="text-primary">{L.title2}</span>
            {L.title3}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            {L.sub}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/signup" size="lg">
              {L.cta}
              <Icon.arrowLeft className="size-4 rotate-180" />
            </ButtonLink>
            <Link
              href="#how"
              className="inline-flex h-12 items-center justify-center rounded-lg px-5 text-[0.95rem] font-medium text-foreground transition-colors hover:bg-surface-muted"
            >
              {L.how}
            </Link>
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="how" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <p className="eyebrow mb-3">{L.processEyebrow}</p>
          <h2 className="mb-10 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            {L.processTitle}
          </h2>
          <ol className="grid divide-y divide-border border-t border-border sm:grid-cols-5 sm:divide-x sm:divide-y-0">
            {L.steps.map((s, i) => (
              <li key={i} className="py-6 sm:px-4 sm:py-2 sm:pt-0">
                <div className="eyebrow mb-3 text-primary">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="mb-1.5 text-base font-semibold tracking-tight">
                  {s.t}
                </div>
                <p className="text-sm leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid overflow-hidden rounded-2xl border border-border md:grid-cols-3">
          {L.features.map((f, i) => {
            const FeatureIcon = FEATURE_ICONS[i] ?? Icon.sparkles;
            const border = [
              "border-b border-border md:border-b-0",
              i < 2 ? "md:border-r md:border-border" : "",
              i === 2 ? "border-b-0" : "",
            ].join(" ");
            return (
              <div key={i} className={`p-7 ${border}`}>
                <div className="mb-4 grid size-10 place-items-center rounded-lg bg-primary-soft text-primary">
                  <FeatureIcon className="size-[20px]" />
                </div>
                <h3 className="mb-2 text-lg font-semibold tracking-tight">
                  {f.t}
                </h3>
                <p className="text-sm leading-relaxed text-muted">{f.d}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mb-24 w-full max-w-6xl px-5 sm:px-8">
        <div className="rounded-3xl border border-border bg-surface px-8 py-16 text-center">
          <h2 className="mx-auto max-w-lg text-2xl font-semibold tracking-tight sm:text-[2rem]">
            {L.ctaTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted">{L.ctaSub}</p>
          <div className="mt-8">
            <ButtonLink href="/signup" size="lg">
              {L.cta}
            </ButtonLink>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
