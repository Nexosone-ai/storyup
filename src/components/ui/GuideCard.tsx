"use client";

import { useState, type ReactNode } from "react";
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

