"use client";

import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

export interface HeroDemoData {
  steps: string[];
  label: string;
  typing: string;
  brand: { name: string; slogan: string; chips: string[] };
  site: {
    url: string;
    headline: string;
    desc: string;
    cta: string;
    cards: string[];
  };
  blog: { tag: string; title: string }[];
}

/**
 * 히어로 라이브 데모 — 4단계 루프:
 * 이야기 타이핑 → 브랜드 카드 → 홈페이지 목업 → 블로그 카드.
 * 시연 영상과 같은 흐름을 실시간 애니메이션으로 보여준다.
 */
export function HeroDemo({ d }: { d: HeroDemoData }) {
  const [scene, setScene] = useState(0);
  const [chars, setChars] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) =>
      timers.push(setTimeout(() => !cancelled && fn(), ms));

    const typeMs = 400 + d.typing.length * 52;
    const s2 = typeMs + 1400; // 브랜드 카드 시작
    const s3 = s2 + 3400; // 홈페이지 목업
    const s4 = s3 + 4200; // 블로그 카드
    const end = s4 + 3400;

    const run = () => {
      if (cancelled) return;
      setScene(0);
      setChars(0);
      for (let i = 1; i <= d.typing.length; i++)
        at(400 + i * 52, () => setChars(i));
      at(s2, () => setScene(1));
      at(s3, () => setScene(2));
      at(s4, () => setScene(3));
      at(end, () => {
        timers = [];
        run();
      });
    };
    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [d]);

  const sceneCls = (i: number) =>
    cn(
      "absolute inset-0 flex flex-col justify-center transition-all duration-500",
      scene === i
        ? "translate-y-0 opacity-100"
        : scene > i
          ? "-translate-y-3 opacity-0"
          : "translate-y-3 opacity-0",
    );

  return (
    <div className="w-full max-w-md">
      {/* 단계 표시 */}
      <div className="mb-5 flex items-center justify-center gap-2">
        {d.steps.map((s, i) => (
          <span
            key={s}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              scene === i ? "bg-primary" : "bg-border-strong",
            )}
          />
        ))}
        <span className="eyebrow ml-2 !text-primary">{d.steps[scene]}</span>
      </div>

      <div className="relative h-[360px]">
        {/* Scene 1 — 이야기 타이핑 */}
        <div className={sceneCls(0)}>
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-lg">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-danger/70" />
              <span className="size-2.5 rounded-full bg-warning/70" />
              <span className="size-2.5 rounded-full bg-success/70" />
              <span className="ml-2 text-xs text-muted">{d.label}</span>
            </div>
            <p className="min-h-20 text-[15px] leading-relaxed">
              {d.typing.slice(0, chars)}
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
            </p>
          </div>
        </div>

        {/* Scene 2 — 브랜드 카드 */}
        <div className={sceneCls(1)}>
          <div className="rounded-2xl border border-primary/25 bg-surface p-8 text-center shadow-lg">
            <p className="font-[family-name:var(--font-display)] text-3xl font-semibold">
              {d.brand.name}
            </p>
            <p className="brand-gradient-text mt-3 text-[15px] font-medium">
              {d.brand.slogan}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {d.brand.chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-border bg-surface-muted px-3 py-1 text-xs text-muted"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Scene 3 — 홈페이지 목업 */}
        <div className={sceneCls(2)}>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
            <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-danger/70" />
              <span className="size-2.5 rounded-full bg-warning/70" />
              <span className="size-2.5 rounded-full bg-success/70" />
              <span className="ml-2 truncate rounded bg-background px-2 py-0.5 font-mono text-[10px] text-muted">
                {d.site.url}
              </span>
            </div>
            <div className="bg-[#e7f0ec] px-5 py-6 text-center">
              <p className="font-[family-name:var(--font-display)] text-[17px] font-semibold text-[#163a2f]">
                {d.site.headline}
              </p>
              <p className="mt-1.5 text-xs text-[#47615a]">{d.site.desc}</p>
              <span className="mt-3 inline-block rounded-lg bg-[#1f6f5a] px-4 py-1.5 text-[11px] font-bold text-white">
                {d.site.cta}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 p-4">
              {d.site.cards.map((c) => (
                <div
                  key={c}
                  className="rounded-lg border border-[#e3e3dc] bg-white p-2.5"
                >
                  <div className="mb-2 h-8 rounded bg-gradient-to-br from-[#d8e8e1] to-[#f2ede2]" />
                  <p className="text-[10px] font-semibold leading-snug text-[#24352f]">
                    {c}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scene 4 — 블로그 · SNS 카드 */}
        <div className={sceneCls(3)}>
          <div className="grid grid-cols-2 gap-3">
            {d.blog.map((b, i) => (
              <div
                key={b.title}
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
              >
                <div
                  className={cn(
                    "h-20",
                    i === 0
                      ? "bg-gradient-to-br from-[#e8c9a8] to-[#b98354]"
                      : "bg-gradient-to-br from-[#cfe0d8] to-[#7ba393]",
                  )}
                />
                <div className="p-3.5">
                  <p className="text-[10px] font-bold text-primary">{b.tag}</p>
                  <p className="mt-1 text-[13px] font-semibold leading-snug">
                    {b.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
