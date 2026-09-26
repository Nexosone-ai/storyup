"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { markWelcomeSeenAction } from "@/app/dashboard/welcome-actions";

interface Step {
  emoji: string;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
}

const STEPS: Step[] = [
  {
    emoji: "👋",
    titleKo: "STORYUP에 오신 걸 환영해요",
    titleEn: "Welcome to STORYUP",
    bodyKo: "AI가 브랜드 스토리부터 홈페이지·블로그·SNS 카드뉴스까지 만들어드려요. 3분이면 첫 결과물을 볼 수 있어요.",
    bodyEn: "AI builds your brand story, landing page, blog, and SNS card news. You'll see your first result in minutes.",
  },
  {
    emoji: "✍️",
    titleKo: "1. 브랜드 스토리 만들기",
    titleEn: "1. Create your brand story",
    bodyKo: "가게·서비스 정보를 입력하면 AI가 브랜드 스토리를 완성해요. 모든 콘텐츠의 출발점이에요.",
    bodyEn: "Enter your business info and AI writes your brand story — the starting point for everything.",
  },
  {
    emoji: "🏗️",
    titleKo: "2. 홈페이지·블로그·카드뉴스",
    titleEn: "2. Landing page, blog & card news",
    bodyKo: "브랜드 스토리를 바탕으로 AI 랜딩페이지, 블로그 글, SNS 카드뉴스를 클릭 몇 번으로 만들어요.",
    bodyEn: "From your story, generate an AI landing page, blog posts, and SNS card news in a few clicks.",
  },
  {
    emoji: "🪙",
    titleKo: "3. 활동하고 UP 받기",
    titleEn: "3. Earn UP as you go",
    bodyKo: "콘텐츠를 만들고 공유하면 UP이 쌓여요. 무료 제공량을 넘는 AI 생성에 사용할 수 있어요.",
    bodyEn: "Create and share to earn UP — spend it on AI generation beyond your free quota.",
  },
];

/**
 * 첫 회원가입 후 대시보드 첫 진입 시 1회 표시하는 환영 가이드.
 * 완료/닫기 시 서버에 onboarded_at 을 기록해 다시 뜨지 않게 한다.
 */
export function WelcomeGuide() {
  const ko = useLocale() === "ko";
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);

  if (!open) return null;

  const last = i === STEPS.length - 1;
  const step = STEPS[i];

  const finish = (goCreate: boolean) => {
    setOpen(false);
    // 기록은 백그라운드로 — 실패해도 UX 방해 없음
    void markWelcomeSeenAction();
    if (goCreate) router.push("/onboarding");
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ko ? "환영 가이드" : "Welcome guide"}
        className="relative z-10 w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
      >
        <button
          type="button"
          aria-label={ko ? "건너뛰기" : "Skip"}
          onClick={() => finish(false)}
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
        >
          <Icon.x width={18} height={18} />
        </button>

        <div className="pt-4 text-center">
          <p className="text-5xl">{step.emoji}</p>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            {ko ? step.titleKo : step.titleEn}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {ko ? step.bodyKo : step.bodyEn}
          </p>
        </div>

        {/* 진행 점 */}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-5 bg-primary" : "w-1.5 bg-border-strong"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => finish(false)}
            className="text-sm font-medium text-muted hover:text-foreground"
          >
            {ko ? "건너뛰기" : "Skip"}
          </button>
          <button
            type="button"
            onClick={() => (last ? finish(true) : setI((v) => v + 1))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {last ? (ko ? "시작하기" : "Get started") : ko ? "다음" : "Next"}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
