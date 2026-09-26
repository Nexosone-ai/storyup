"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";

/** beforeinstallprompt 이벤트 (표준 타입이 없어 최소 형태만 정의). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const LATER_KEY = "install-later-until";
const DAY_MS = 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

function snoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(LATER_KEY) ?? 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

/**
 * 앱 설치 유도 팝업 — PWA를 홈 화면/데스크톱에 설치하도록 안내한다.
 * - 크롬/안드로이드: beforeinstallprompt를 잡아 두었다가 '설치하기' 클릭 시 프롬프트를 띄운다.
 * - iOS Safari: 프롬프트가 없어 '홈 화면에 추가' 안내를 보여준다.
 * - '나중에' 클릭 시 24시간 뒤에 다시 뜬다(localStorage).
 * - 이미 설치(standalone) 상태면 표시하지 않는다.
 */
export function InstallPromptPopup() {
  const ko = useLocale() === "ko";
  const [open, setOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;

    // 서비스워커 등록 — 설치 가능(installability) 조건 충족.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const ios = /iphone|ipad|ipod/i.test(nav.userAgent);

    const show = () => {
      if (!snoozed()) setOpen(true);
    };

    const startIos = () => {
      // iOS는 beforeinstallprompt가 없어 바로 안내 팝업을 띄운다.
      setIsIos(true);
      show();
    };
    if (ios) startIos();

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
      show();
    };
    const onInstalled = () => {
      setDeferred(null);
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!open) return null;

  const later = () => {
    try {
      localStorage.setItem(LATER_KEY, String(Date.now() + DAY_MS));
    } catch {
      /* 저장 실패해도 닫기는 진행 */
    }
    setOpen(false);
  };

  const install = async () => {
    if (!deferred) return; // iOS는 안내만
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={later} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ko ? "앱 설치" : "Install app"}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">
              {ko ? "STORYUP 앱 설치하기" : "Install the STORYUP app"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {ko
                ? "홈 화면에 추가하면 앱처럼 더 빠르게 열고, 만기·소식 알림도 받을 수 있어요."
                : "Add to your home screen for faster access and expiry & news notifications."}
            </p>
          </div>
        </div>

        {isIos && (
          <p className="mt-4 rounded-lg bg-surface-muted px-3 py-2 text-xs leading-relaxed text-muted">
            {ko
              ? "Safari 하단 공유 버튼(□↑)을 누른 뒤 '홈 화면에 추가'를 선택하세요."
              : "Tap the Share button (□↑) in Safari, then choose 'Add to Home Screen'."}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={later}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground"
          >
            {ko ? "나중에" : "Later"}
          </button>
          {!isIos && (
            <button
              type="button"
              onClick={install}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Icon.check width={16} height={16} />
              {ko ? "설치하기" : "Install"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
