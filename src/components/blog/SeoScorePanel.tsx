"use client";

import { useMemo, useState } from "react";
import { computeSeoReport, type SeoInput } from "@/utils/seoScore";
import { cn } from "@/utils/cn";
import { useLocale } from "@/components/i18n/LocaleProvider";

const STATUS_ICON = { pass: "✓", warn: "△", fail: "✕" } as const;
const STATUS_COLOR = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-danger",
} as const;

/** 글 작성 화면의 실시간 SEO 자가진단 패널. */
export function SeoScorePanel(input: SeoInput) {
  const ko = useLocale() === "ko";
  const [open, setOpen] = useState(false);
  const report = useMemo(() => computeSeoReport(input), [input]);

  const tone =
    report.score >= 80
      ? "text-success"
      : report.score >= 50
        ? "text-warning"
        : "text-danger";
  const issues = report.checks.filter((c) => c.status !== "pass");

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {ko ? "SEO 점수" : "SEO Score"}
          <span className={cn("text-base font-bold", tone)}>
            {report.score}
            <span className="text-xs font-medium text-muted">/100</span>
          </span>
        </span>
        <span className="text-xs text-muted">
          {issues.length === 0
            ? ko
              ? "모든 항목 통과"
              : "All checks pass"
            : ko
              ? `개선 항목 ${issues.length}개 ${open ? "접기" : "보기"}`
              : `${issues.length} to improve · ${open ? "hide" : "view"}`}
        </span>
      </button>

      {open && (
        <ul className="space-y-2 border-t border-border px-4 py-3">
          {report.checks.map((c) => (
            <li key={c.id} className="text-sm">
              <span className={cn("mr-2 font-bold", STATUS_COLOR[c.status])}>
                {STATUS_ICON[c.status]}
              </span>
              <span
                className={c.status === "pass" ? "text-muted" : "font-medium"}
              >
                {ko ? c.label.ko : c.label.en}
              </span>
              {c.status !== "pass" && c.hint && (
                <p className="ml-6 mt-0.5 text-xs leading-relaxed text-muted">
                  {ko ? c.hint.ko : c.hint.en}
                </p>
              )}
            </li>
          ))}
          <li className="pt-1 text-[11px] leading-relaxed text-muted">
            {ko
              ? "점수는 참고용입니다. 키워드를 억지로 반복하면 오히려 감점되며, 독자에게 유용한 글이 가장 좋은 SEO입니다."
              : "This score is a guide. Forced keyword repetition is penalized — genuinely useful content is the best SEO."}
          </li>
        </ul>
      )}
    </div>
  );
}
