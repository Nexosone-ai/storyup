"use client";

import { useEffect, useState } from "react";

/** beforeinstallprompt 이벤트 (표준 타입이 없어 최소 형태만 정의). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** 숨김 / iOS 수동 안내 / 크롬 설치 프롬프트 가능 */
type Mode = "hidden" | "ios" | "prompt";

/**
 * "앱 설치하기" 버튼 — PWA를 홈 화면/데스크톱에 설치한다.
 * - 크롬/안드로이드: beforeinstallprompt를 잡아 두었다가 클릭 시 설치 프롬프트를 띄운다.
 * - iOS Safari: 프롬프트를 지원하지 않아 '홈 화면에 추가' 안내를 보여준다.
 * - 이미 설치돼 앱으로 실행 중이면 아무것도 렌더링하지 않는다.
 */
export function InstallAppButton({
  ko,
  onAction,
}: {
  ko: boolean;
  onAction?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("hidden");
  const [iosHelp, setIosHelp] = useState(false);
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    // 이미 설치되어 standalone으로 실행 중이면 버튼을 숨긴다.
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      nav.standalone === true;
    if (standalone) return;

    // 서비스워커 등록 — 설치 가능(installability) 조건을 충족시킨다.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // iOS Safari는 beforeinstallprompt가 없어 수동 안내가 필요하다.
    if (/iphone|ipad|ipod/i.test(nav.userAgent)) {
      // 마운트 후 클라이언트에서만 노출 (SSR 하이드레이션 불일치 방지).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("ios");
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => {
      setDeferred(null);
      setMode("hidden");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  const onClick = async () => {
    if (mode === "ios") {
      setIosHelp((v) => !v);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setMode("hidden");
    onAction?.();
  };

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-2.5 rounded-xl border border-primary/40 bg-primary-soft px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="shrink-0"
        >
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-left">
          {ko ? "앱 설치하기" : "Install app"}
        </span>
      </button>
      {mode === "ios" && iosHelp && (
        <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs leading-relaxed text-muted">
          {ko
            ? "Safari 하단 공유 버튼(□↑)을 누른 뒤 '홈 화면에 추가'를 선택하세요."
            : "Tap the Share button (□↑) in Safari, then choose 'Add to Home Screen'."}
        </p>
      )}
    </div>
  );
}
