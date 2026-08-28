import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import Link from "next/link";
import { getDict } from "@/lib/i18n";
import type { SVGProps } from "react";

/* Story-type glyphs local to the landing page (plane / storefront / coffee / cutlery) */
function StoryIcon({ d, ...props }: SVGProps<SVGSVGElement> & { d: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={d} />
    </svg>
  );
}

const STORY_TYPES = [
  {
    tone: "accent",
    d: "M10.5 13.5 3 11l1.5-1.5 5.5.5 4.5-4.5a1.6 1.6 0 0 1 2.3 2.3L12.5 12l.5 5.5L11.5 19l-2.5-7.5Z",
  },
  {
    tone: "primary",
    d: "M4 9h16l-1-4H5L4 9Zm0 0v10h16V9M9 19v-5h6v5",
  },
  {
    tone: "tertiary",
    d: "M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 1h2a2 2 0 0 1 0 4h-2M7 4v2m4-2v2",
  },
  {
    tone: "accent",
    d: "M7 3v7a2 2 0 0 0 2 2v9M7 3v4m4-4v7a2 2 0 0 1-2 2m8-9c-2 1-3 3-3 6v3h3v9",
  },
] as const;

const TONE = {
  accent: {
    border: "border-accent/30",
    text: "text-accent",
    hover: "group-hover:text-accent",
  },
  primary: {
    border: "border-primary/30",
    text: "text-primary",
    hover: "group-hover:text-primary",
  },
  tertiary: {
    border: "border-tertiary/30",
    text: "text-tertiary",
    hover: "group-hover:text-tertiary",
  },
} as const;

export default async function LandingPage() {
  const { t } = await getDict();
  const L = t.landing;

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      {/* Full-bleed intro video */}
      <section className="relative h-[70svh] w-full overflow-hidden bg-black sm:h-svh">
        <video
          className="absolute inset-0 size-full object-cover"
          src="/videos/intro.mp4"
          autoPlay
          muted
          loop
          playsInline
        />
        {/* 아래 히어로 배경으로 자연스럽게 이어지는 그라데이션 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#0a0a12]" />
      </section>

      {/* Hero — Neon Tokyo */}
      <section className="hero-gradient relative flex flex-col items-center overflow-hidden px-5 pt-16 pb-28 text-center sm:px-8 sm:pt-20 sm:pb-36">
        <div className="neon-glow mb-8 inline-flex items-center justify-center rounded-full border border-primary/30 bg-surface-muted px-4 py-1.5">
          <span className="font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {L.badge}
          </span>
        </div>
        <h1 className="mx-auto max-w-4xl text-[2.9rem] font-extrabold leading-[1.12] tracking-tight sm:text-7xl">
          {L.title1}
          <br />
          <span className="neon-text text-primary">{L.title2}</span>
          {L.title3}
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted">
          {L.sub}
        </p>
        <div className="mt-12 flex w-full max-w-md flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
          <Link
            href="/signup"
            className="neon-glow w-full rounded-lg bg-primary px-8 py-4 font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.15em] text-primary-foreground transition-all duration-300 hover:bg-primary-hover sm:w-auto sm:flex-1"
          >
            {L.cta}
          </Link>
          <Link
            href="#how"
            className="w-full rounded-lg border border-primary px-8 py-4 font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.15em] text-primary transition-all duration-300 hover:bg-primary/10 sm:w-auto sm:flex-1"
          >
            {L.how}
          </Link>
        </div>
      </section>

      {/* Story types */}
      <section
        id="how"
        className="border-y border-border/60 bg-[#111118] px-5 py-20 sm:px-8"
      >
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="mb-12 text-2xl font-semibold uppercase tracking-wide sm:text-[1.75rem]">
            {L.storyT1}
            <span className="neon-text-cyan text-accent">{L.storyT2}</span>
            {L.storyT3}
          </h2>
          <div className="flex flex-wrap justify-center gap-10 md:gap-20">
            {L.storyTypes.map((label, i) => {
              const s = STORY_TYPES[i] ?? STORY_TYPES[0];
              const tone = TONE[s.tone];
              return (
                <div
                  key={label}
                  className="group flex cursor-default flex-col items-center"
                >
                  <div
                    className={`mb-4 flex size-16 items-center justify-center rounded-xl border bg-surface-muted transition-all duration-300 group-hover:-translate-y-2 group-hover:neon-glow ${tone.border} ${tone.text}`}
                  >
                    <StoryIcon d={s.d} />
                  </div>
                  <span
                    className={`font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.15em] text-muted transition-colors ${tone.hover}`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Editorial band — light, serif, glass panels */}
      <section className="bg-[#f9f9f8] px-5 py-24 text-[#1a1c1c] sm:px-8 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="story-line mb-20 text-center">
            <h2 className="mb-4 font-[family-name:var(--font-serif)] text-3xl font-normal text-[#554b73] sm:text-4xl">
              {L.elevateTitle}
            </h2>
            <p className="mx-auto max-w-xl text-base text-[#48454e]">
              {L.elevateSub}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* AI Blog Generation */}
            <div className="editorial-glass-panel editorial-bracket-tl group flex flex-col justify-between rounded-2xl bg-white p-10 md:col-span-8">
              <div>
                <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-[rgba(217,195,225,0.4)] text-[#554b73]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.7 4.6L18 9.2l-4.3 1.6L12 15.5l-1.7-4.7L6 9.2l4.3-1.6L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
                  </svg>
                </div>
                <h3 className="mb-4 font-[family-name:var(--font-serif)] text-[28px] font-normal text-[#554b73] transition-colors group-hover:text-[#5c4b64]">
                  {L.bentoBlogT}
                </h3>
                <p className="max-w-md text-base text-[#48454e]">{L.bentoBlogD}</p>
              </div>
              <div className="mt-8 h-48 rounded-lg bg-gradient-to-br from-[#e9e2f2] via-[#f5f0ea] to-[#f9d7dd] opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
            </div>

            {/* Card News */}
            <div className="editorial-glass-panel editorial-bracket-br flex flex-col justify-between rounded-2xl bg-white p-10 md:col-span-4">
              <div>
                <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-[#f9d7dd] text-[#71585d]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="7" y="5" width="10" height="14" rx="1.5" />
                    <path d="M3.5 7v10M20.5 7v10" />
                  </svg>
                </div>
                <h3 className="mb-4 font-[family-name:var(--font-serif)] text-[28px] font-normal text-[#554b73]">
                  {L.bentoCardT}
                </h3>
                <p className="text-base text-[#48454e]">{L.bentoCardD}</p>
              </div>
              <div className="mt-8">
                <Link
                  href="/signup"
                  className="inline-flex items-center font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.15em] text-[#554b73] underline-offset-4 hover:underline"
                >
                  {L.tryNow}
                  <svg className="ml-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Story Connect */}
            <div className="editorial-glass-panel ambient-shadow mt-4 flex flex-col items-center gap-12 rounded-2xl bg-white p-10 md:col-span-12 md:flex-row">
              <div className="flex-1">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-[#e2e2e2] px-3 py-1">
                  <span className="font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.15em] text-[#48454e]">
                    {L.communityLabel}
                  </span>
                </div>
                <h3 className="mb-6 font-[family-name:var(--font-serif)] text-4xl font-normal leading-[1.1] tracking-[-0.02em] text-[#554b73] sm:text-[56px]">
                  {L.connectTitle}
                </h3>
                <p className="mb-8 max-w-lg text-lg leading-[1.6] text-[#48454e]">
                  {L.connectSub}
                </p>
                <Link
                  href="/signup"
                  className="inline-flex rounded-lg border border-[#554b73] px-6 py-2.5 font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.15em] text-[#554b73] transition-all duration-300 hover:bg-[#554b73]/5"
                >
                  {L.connectCta}
                </Link>
              </div>
              <div className="editorial-bracket-tl editorial-bracket-br h-[260px] w-full flex-1 rounded-lg bg-gradient-to-br from-[#d9c3e1]/50 via-[#f5f0ea] to-[#c9d8d2]/60 sm:h-[320px]" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
