"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";

export interface TourStep {
  /** 짚어줄 요소의 CSS 선택자 (예: "[data-tour=blog-new]") */
  target: string;
  title: string;
  desc: string;
}

// 같은 탭 안에서 완료 상태 변경을 알리는 최소 스토어 (useSyncExternalStore용)
const tourListeners = new Set<() => void>();
function subscribeTour(cb: () => void) {
  tourListeners.add(cb);
  return () => {
    tourListeners.delete(cb);
  };
}
function emitTour() {
  tourListeners.forEach((cb) => cb());
}

const TOOLTIP_W = 320;

/**
 * 화면의 실제 버튼·영역을 어둡게 덮은 뒤 하나씩 밝게 짚어주는 안내 투어.
 * 처음 방문(autoStart)에 자동으로 시작하고, 완료하면 localStorage에 기억한다.
 * 평소에는 "사용법 안내" 버튼 한 줄만 렌더링되어 언제든 다시 볼 수 있다.
 */
export function GuidedTour({
  storageKey,
  steps,
  autoStart = true,
}: {
  /** 완료 기억 키 — 문구를 크게 바꾸면 버전을 올린다 (예: "tour.blog.v1") */
  storageKey: string;
  steps: TourStep[];
  /** 처음 온 사용자에게 자동으로 시작할지 (서버에서 진행 상황 보고 결정) */
  autoStart?: boolean;
}) {
  const ko = useLocale() === "ko";
  // 서버 스냅숏은 '완료'로 두어 SSR/하이드레이션에서 오버레이가 뜨지 않게 한다.
  const done = useSyncExternalStore(
    subscribeTour,
    () => {
      try {
        return localStorage.getItem(storageKey) === "1";
      } catch {
        return true;
      }
    },
    () => true,
  );
  const [manual, setManual] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const active = manual || (autoStart && !done);
  const step = active ? steps[idx] : undefined;
  const target = step?.target;

  // 대상 요소 위치 추적 — 스크롤·리사이즈·레이아웃 변화를 따라간다.
  useEffect(() => {
    if (!target) return;
    let raf = 0;
    const update = () => {
      const el = document.querySelector(target);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    raf = requestAnimationFrame(() => {
      document
        .querySelector(target)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      update();
    });
    const timer = setInterval(update, 250);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target]);

  const finish = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // 저장 실패 시 이번 세션에서만 닫힌다
    }
    emitTour();
    setManual(false);
    setIdx(0);
  };

  const restart = () => {
    setIdx(0);
    setManual(true);
  };

  if (!active || !step) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={restart}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted underline-offset-2 hover:text-primary hover:underline"
        >
          <Icon.sparkles width={14} height={14} />
          {ko ? "사용법 안내 보기" : "Show how-to guide"}
        </button>
      </div>
    );
  }

  const last = idx === steps.length - 1;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const pad = 8;

  // 말풍선 위치: 대상 아래 우선, 공간이 없으면 위. 대상이 없으면 화면 중앙.
  let tipStyle: React.CSSProperties;
  if (rect) {
    const below = rect.bottom + 220 < vh || rect.top < 200;
    const left = Math.min(Math.max(rect.left, 16), Math.max(16, vw - TOOLTIP_W - 16));
    tipStyle = below
      ? { top: rect.bottom + 14, left }
      : { top: rect.top - 14, left, transform: "translateY(-100%)" };
  } else {
    tipStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {/* 스포트라이트 — 대상만 밝게, 나머지는 어둡게 */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all duration-200"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(10, 10, 10, 0.55)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/55" />
      )}

      {/* 말풍선 */}
      <div
        className="fixed rounded-2xl border border-border bg-surface p-4 shadow-xl"
        style={{ ...tipStyle, width: TOOLTIP_W, maxWidth: "calc(100vw - 32px)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="tnum text-xs font-bold text-primary">
            {idx + 1} / {steps.length}
          </span>
          <button
            type="button"
            onClick={finish}
            className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            {ko ? "건너뛰기" : "Skip"}
          </button>
        </div>
        <p className="mt-2 font-semibold">{step.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{step.desc}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full ${i === idx ? "bg-primary" : "bg-border-strong"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {idx > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setIdx(idx - 1)}>
                {ko ? "이전" : "Back"}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => (last ? finish() : setIdx(idx + 1))}
            >
              {last ? (ko ? "시작하기!" : "Got it!") : ko ? "다음" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
