"use client";

import { useState } from "react";
import Link from "next/link";
import type { SeoReport } from "@/utils/seoScore";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { cn } from "@/utils/cn";

const STATUS_ICON = { pass: "✓", warn: "△", fail: "✕" } as const;
const STATUS_COLOR = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-danger",
} as const;

export interface SeoAuditItem {
  postId: string;
  title: string;
  /** "published" | "draft" 등 */
  status: string;
  editHref: string;
  report: SeoReport;
}

function tone(score: number) {
  return score >= 80
    ? "text-success"
    : score >= 50
      ? "text-warning"
      : "text-danger";
}

/**
 * 애널리틱스의 글별 SEO 진단 — 각 글의 SEO 점수와 개선 항목을 한곳에서 보여준다.
 * 점수 계산은 서버에서 끝내고(computeSeoReport), 여기선 펼치기·링크만 담당한다.
 */
export function SeoAudit({ items }: { items: SeoAuditItem[] }) {
  const ko = useLocale() === "ko";

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        {ko
          ? "아직 작성한 블로그 글이 없습니다. 글을 쓰면 여기에서 글별 SEO 점수를 확인할 수 있어요."
          : "No blog posts yet. Once you write posts, per-post SEO scores appear here."}
      </p>
    );
  }

  // 점수 낮은 글이 위로 오도록 정렬(가장 손봐야 할 글 우선).
  const sorted = [...items].sort((a, b) => a.report.score - b.report.score);
  const avg = Math.round(
    items.reduce((s, it) => s + it.report.score, 0) / items.length,
  );
  const needAttention = items.filter((it) => it.report.score < 80).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-sm text-muted">
          {ko ? "평균 SEO 점수" : "Average SEO score"}{" "}
          <span className={cn("text-lg font-bold", tone(avg))}>
            {avg}
            <span className="text-xs font-medium text-muted">/100</span>
          </span>
        </p>
        <p className="text-sm text-muted">
          {ko
            ? `개선이 필요한 글 ${needAttention}개`
            : `${needAttention} post(s) to improve`}
        </p>
      </div>

      <ul className="space-y-2.5">
        {sorted.map((it) => (
          <SeoAuditRow key={it.postId} item={it} ko={ko} />
        ))}
      </ul>

      <p className="text-[11px] leading-relaxed text-muted">
        {ko
          ? "점수는 참고용입니다. 키워드를 억지로 반복하면 오히려 감점되며, 독자에게 유용한 글이 가장 좋은 SEO입니다."
          : "This score is a guide. Forced keyword repetition is penalized — genuinely useful content is the best SEO."}
      </p>
    </div>
  );
}

function SeoAuditRow({ item, ko }: { item: SeoAuditItem; ko: boolean }) {
  const [open, setOpen] = useState(false);
  const issues = item.report.checks.filter((c) => c.status !== "pass");
  const isDraft = item.status !== "published";

  return (
    <li className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted/50"
      >
        <span
          className={cn(
            "tnum w-11 shrink-0 text-lg font-bold",
            tone(item.report.score),
          )}
        >
          {item.report.score}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{item.title}</span>
            {isDraft && (
              <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted">
                {ko ? "비공개" : "Draft"}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {issues.length === 0
              ? ko
                ? "모든 항목 통과"
                : "All checks pass"
              : ko
                ? `개선 항목 ${issues.length}개`
                : `${issues.length} to improve`}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted">
          {open ? (ko ? "접기" : "Hide") : ko ? "보기" : "View"}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <ul className="space-y-2">
            {item.report.checks.map((c) => (
              <li key={c.id} className="text-sm">
                <span
                  className={cn("mr-2 font-bold", STATUS_COLOR[c.status])}
                >
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
          </ul>
          <Link
            href={item.editHref}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            {ko ? "이 글 수정하기" : "Edit this post"}
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </li>
  );
}
