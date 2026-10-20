"use client";

import { useEffect, useState } from "react";
import type { SiteSlideItem } from "@/types/domain";
import { safeCtaHref } from "./shared";

/**
 * 메인 슬라이드(공개) — 배경 이미지 위 오버레이 문구/CTA의 자동 캐러셀.
 * 접근성: 수동 화살표·점 이동 가능, prefers-reduced-motion이면 자동전환 멈춤.
 */
export function HeroSlider({ slides }: { slides: SiteSlideItem[] }) {
  const list = slides.filter((s) => s.image || s.title || s.subtitle);
  const [i, setI] = useState(0);
  const n = list.length;

  useEffect(() => {
    if (n <= 1) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n]);

  if (n === 0) return null;
  const go = (k: number) => setI(((k % n) + n) % n);

  return (
    <section className="relative border-t border-border">
      <div className="relative h-[clamp(320px,56vw,560px)] w-full overflow-hidden bg-surface-muted/40">
        {list.map((s, k) => (
          <div
            key={k}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: k === i ? 1 : 0, pointerEvents: k === i ? "auto" : "none" }}
            aria-hidden={k !== i}
          >
            {s.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- 동적 원격 이미지
              <img
                src={s.image}
                alt={s.title ?? ""}
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,var(--primary-soft),transparent_65%)]" />
            )}
            {(s.title || s.subtitle || s.ctaLabel) && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              {s.title && (
                <h2 className="max-w-3xl text-3xl font-black leading-tight tracking-tight text-white drop-shadow sm:text-5xl">
                  {s.title}
                </h2>
              )}
              {s.subtitle && (
                <p className="mt-3 max-w-xl text-white/90 drop-shadow sm:text-lg">
                  {s.subtitle}
                </p>
              )}
              {s.ctaLabel && (
                <a
                  href={safeCtaHref(s.ctaHref)}
                  className="mt-7 inline-flex h-12 items-center rounded-full bg-white px-7 font-bold text-gray-900 shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  {s.ctaLabel}
                </a>
              )}
            </div>
          </div>
        ))}

        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(i - 1)}
              aria-label="이전 슬라이드"
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-gray-800 shadow hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(i + 1)}
              aria-label="다음 슬라이드"
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-gray-800 shadow hover:bg-white"
            >
              ›
            </button>
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
              {list.map((_, k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => go(k)}
                  aria-label={`슬라이드 ${k + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    k === i ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
