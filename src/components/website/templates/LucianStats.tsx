"use client";

/* 통계 섹션 — 화면에 들어오면 숫자가 0에서 목표까지 굴러 오른다(count-up).
 * Lucian UX/UI의 '숫자가 굴러 오르는' 모션 결(#056 odometer 등)을 섹션 지표에 적용.
 * 접두/접미 문자(₩, %, +, 명 등)는 그대로 두고 숫자 부분만 센다. 모션 감소 시 즉시 표시.
 */

import { useEffect, useRef, useState } from "react";

interface Stat {
  value: string;
  label: string;
}

/** "₩1,200+" → { prefix:"₩", num:1200, suffix:"+", decimals:0 } (숫자 없으면 num=null) */
function parseValue(v: string): {
  prefix: string;
  suffix: string;
  num: number | null;
  decimals: number;
} {
  const m = v.match(/[\d,]+(?:\.\d+)?/);
  if (!m) return { prefix: v, suffix: "", num: null, decimals: 0 };
  const raw = m[0];
  const num = parseFloat(raw.replace(/,/g, ""));
  const dot = raw.indexOf(".");
  const decimals = dot === -1 ? 0 : raw.length - dot - 1;
  return {
    prefix: v.slice(0, m.index),
    suffix: v.slice((m.index ?? 0) + raw.length),
    num,
    decimals,
  };
}

function StatValue({ value }: { value: string }) {
  const parsed = parseValue(value);
  const [n, setN] = useState(parsed.num ?? 0);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (parsed.num === null) return;
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    if (reduce) {
      const target = parsed.num;
      raf = requestAnimationFrame(() => setN(target));
      return () => cancelAnimationFrame(raf);
    }
    let started = false;
    const run = () => {
      started = true;
      const target = parsed.num as number;
      const dur = 1200;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(target * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const display =
    parsed.num === null
      ? value
      : parsed.prefix +
        n.toLocaleString("en-US", {
          minimumFractionDigits: parsed.decimals,
          maximumFractionDigits: parsed.decimals,
        }) +
        parsed.suffix;

  return (
    <p
      ref={ref}
      className="text-3xl font-black tracking-tight text-primary tabular-nums sm:text-4xl"
    >
      {display}
    </p>
  );
}

export function LucianStats({ items }: { items: Stat[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it, j) => (
        <div key={j} className="text-center">
          <StatValue value={it.value} />
          <p className="mt-1 text-sm text-muted">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
