"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";

export interface GuideStep {
  title: string;
  desc?: string;
}

/** 번호 칩이 붙은 "이렇게 하세요" 단계 목록 — 가이드 UI 공용. */
export function GuideSteps({ steps }: { steps: GuideStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{s.title}</p>
            {s.desc && <p className="mt-0.5 text-sm text-muted">{s.desc}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** 복사 → 복사됨 토글 버튼. text에 함수를 주면 클릭 시점 값으로 복사한다. */
export function CopyButton({
  text,
  children,
  variant = "outline",
}: {
  text: string | (() => string);
  children?: ReactNode;
  variant?: "outline" | "primary" | "secondary";
}) {
  const ko = useLocale() === "ko";
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(
      typeof text === "function" ? text() : text,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button variant={variant} size="sm" onClick={copy}>
      {copied ? (
        <Icon.check width={16} height={16} />
      ) : (
        <Icon.copy width={16} height={16} />
      )}
      {copied ? (ko ? "복사됨" : "Copied") : (children ?? (ko ? "복사" : "Copy"))}
    </Button>
  );
}

// 같은 탭 안에서 접힘 상태 변경을 알리는 최소 스토어 (useSyncExternalStore용)
const guideListeners = new Set<() => void>();
function subscribeGuide(cb: () => void) {
  guideListeners.add(cb);
  return () => {
    guideListeners.delete(cb);
  };
}

/**
 * 페이지 상단의 접을 수 있는 사용 안내 카드.
 * 접힘 상태는 localStorage(storageKey)에 기억한다 — 삭제가 아니라
 * 언제든 다시 펼칠 수 있게 한 줄로만 줄어든다.
 */
export function GuideCard({
  storageKey,
  title,
  steps,
  footer,
}: {
  /** 문구를 바꾸면 버전을 올려 다시 펼쳐지게 한다 (예: "guide.blog.v1") */
  storageKey: string;
  title: string;
  steps: GuideStep[];
  footer?: ReactNode;
}) {
  const ko = useLocale() === "ko";
  // 서버 스냅숏은 항상 '펼침' — 하이드레이션 후 저장값으로 안전하게 전환된다.
  const collapsed = useSyncExternalStore(
    subscribeGuide,
    () => {
      try {
        return localStorage.getItem(storageKey) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );

  const toggle = () => {
    try {
      localStorage.setItem(storageKey, collapsed ? "0" : "1");
      guideListeners.forEach((cb) => cb());
    } catch {
      // localStorage 접근 불가 환경에서는 접힘 상태를 저장/전환하지 않는다
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary-soft/40 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <Icon.sparkles width={18} height={18} className="shrink-0 text-primary" />
          {title}
        </p>
        <button
          type="button"
          onClick={toggle}
          className="shrink-0 text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          {collapsed ? (ko ? "펼치기" : "Show") : ko ? "접기" : "Hide"}
        </button>
      </div>
      {!collapsed && (
        <div className="mt-4 space-y-4">
          <GuideSteps steps={steps} />
          {footer}
        </div>
      )}
    </div>
  );
}
