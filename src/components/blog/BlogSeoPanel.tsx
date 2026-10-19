"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  computeSeoReport,
  type SeoInput,
  type SeoCheck,
  type SeoLane,
} from "@/utils/seoScore";
import { cn } from "@/utils/cn";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  analyzeBlogSeoAction,
  applyBlogSeoAction,
} from "@/app/business/seo-actions";
import type { BlogSeoAnalysisCache } from "@/types/domain";

const STATUS_ICON = { pass: "✓", warn: "△", fail: "✕" } as const;
const STATUS_COLOR = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-danger",
} as const;

const LANE_META: Record<SeoLane, { ko: string; en: string; descKo: string; descEn: string }> = {
  seo: {
    ko: "검색 노출 (구글·네이버)",
    en: "Search (Google·Naver)",
    descKo: "검색 결과에 어떻게 잡히는지",
    descEn: "How it appears in search",
  },
  aeo: {
    ko: "AI 답변 노출 (AEO)",
    en: "AI answers (AEO)",
    descKo: "AI 답변·FAQ 인용(구글 AI Overviews·ChatGPT 등)",
    descEn: "Cited by AI answers (AI Overviews·ChatGPT)",
  },
};

export interface BlogSeoPanelProps extends SeoInput {
  businessId: string;
  postId: string;
  seoAllowed: boolean;
  initialAnalysis?: BlogSeoAnalysisCache | null;
}

export function BlogSeoPanel({
  businessId,
  postId,
  seoAllowed,
  initialAnalysis,
  ...input
}: BlogSeoPanelProps) {
  const ko = useLocale() === "ko";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const report = useMemo(() => computeSeoReport(input), [input]);
  const [analysis, setAnalysis] = useState<BlogSeoAnalysisCache | null>(
    initialAnalysis ?? null,
  );
  const [analyzing, startAnalyze] = useTransition();
  const [applying, startApply] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const tone =
    report.score >= 80 ? "text-success" : report.score >= 50 ? "text-warning" : "text-danger";
  const issues = report.checks.filter((c) => c.status !== "pass");

  const lanes: SeoLane[] = ["seo", "aeo"];
  const byLane = (lane: SeoLane): SeoCheck[] =>
    report.checks.filter((c) => c.lane === lane);

  const runAnalyze = () => {
    setError(null);
    startAnalyze(async () => {
      const res = await analyzeBlogSeoAction(businessId, postId);
      if (res.error) setError(res.error);
      else if (res.analysis) {
        setAnalysis(res.analysis);
        setApplied(new Set());
      }
    });
  };

  const apply = (
    key: string,
    fields: { seoTitle?: string; seoDescription?: string; keywords?: string[] },
  ) => {
    setError(null);
    startApply(async () => {
      const res = await applyBlogSeoAction(businessId, postId, fields);
      if (res.error) setError(res.error);
      else {
        setApplied((prev) => new Set(prev).add(key));
        router.refresh();
      }
    });
  };

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
  };

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {ko ? "SEO 진단·보강" : "SEO guidance"}
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
              ? `개선 ${issues.length}개 ${open ? "접기" : "보기"}`
              : `${issues.length} to improve · ${open ? "hide" : "view"}`}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-3">
          {/* 레인별 규칙 진단 */}
          {lanes.map((lane) => {
            const checks = byLane(lane);
            if (checks.length === 0) return null;
            const meta = LANE_META[lane];
            return (
              <div key={lane}>
                <p className="text-xs font-semibold text-foreground">
                  {ko ? meta.ko : meta.en}
                  <span className="ml-1.5 font-normal text-muted">
                    · {ko ? meta.descKo : meta.descEn}
                  </span>
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {checks.map((c) => (
                    <li key={c.id} className="text-sm">
                      <span className={cn("mr-2 font-bold", STATUS_COLOR[c.status])}>
                        {STATUS_ICON[c.status]}
                      </span>
                      <span className={c.status === "pass" ? "text-muted" : "font-medium"}>
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
              </div>
            );
          })}

          {/* AI 보강 분석 */}
          <div className="rounded-xl border border-border bg-background p-3">
            {!seoAllowed ? (
              <p className="text-xs leading-relaxed text-muted">
                {ko
                  ? "이 글의 약점과 개선 문구(제목·메타·결론 먼저 도입·키워드·FAQ)를 AI가 제안하는 기능은 유료 플랜(Basic 이상)에서 사용할 수 있어요."
                  : "AI weakness analysis & suggested copy is available on paid plans (Basic+)."}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold">
                    {ko ? "AI 보강 분석" : "AI analysis"}
                    {analysis && (
                      <span className="ml-1.5 font-normal text-muted">
                        {ko ? "— 약점 진단 + 개선 문구 제안" : "— weaknesses + suggestions"}
                      </span>
                    )}
                  </p>
                  <Button size="sm" variant="outline" onClick={runAnalyze} disabled={analyzing}>
                    {analyzing ? (
                      <Spinner className="size-4" />
                    ) : analysis ? (
                      ko ? "다시 분석" : "Re-analyze"
                    ) : ko ? (
                      "AI로 진단하기"
                    ) : (
                      "Analyze"
                    )}
                  </Button>
                </div>

                {error && <p className="mt-2 text-xs text-danger">{error}</p>}

                {analysis && (
                  <div className="mt-3 space-y-3">
                    {analysis.weaknesses.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {ko ? "약점" : "Weaknesses"}
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-muted">
                          {analysis.weaknesses.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysis.seoTitle && (
                      <Suggestion
                        label={ko ? "제안 SEO 제목" : "Suggested SEO title"}
                        text={analysis.seoTitle}
                        applied={applied.has("title")}
                        busy={applying}
                        applyLabel={ko ? "적용" : "Apply"}
                        onApply={() => apply("title", { seoTitle: analysis.seoTitle })}
                      />
                    )}
                    {analysis.seoDescription && (
                      <Suggestion
                        label={ko ? "제안 메타 설명" : "Suggested meta description"}
                        text={analysis.seoDescription}
                        applied={applied.has("desc")}
                        busy={applying}
                        applyLabel={ko ? "적용" : "Apply"}
                        onApply={() =>
                          apply("desc", { seoDescription: analysis.seoDescription })
                        }
                      />
                    )}
                    {analysis.keywords && analysis.keywords.length > 0 && (
                      <Suggestion
                        label={ko ? "제안 키워드" : "Suggested keywords"}
                        text={analysis.keywords.join(", ")}
                        applied={applied.has("kw")}
                        busy={applying}
                        applyLabel={ko ? "적용" : "Apply"}
                        onApply={() => apply("kw", { keywords: analysis.keywords })}
                      />
                    )}
                    {analysis.firstParagraph && (
                      <Suggestion
                        label={ko ? "제안 도입 문단 (결론 먼저)" : "Suggested intro (answer first)"}
                        text={analysis.firstParagraph}
                        applied={copied === "intro"}
                        busy={false}
                        applyLabel={copied === "intro" ? (ko ? "복사됨" : "Copied") : ko ? "복사" : "Copy"}
                        onApply={() => copy("intro", analysis.firstParagraph!)}
                        note={
                          ko
                            ? "본문 맨 앞에 붙여넣어 보세요."
                            : "Paste at the top of the body."
                        }
                      />
                    )}
                    {analysis.faqIdeas && analysis.faqIdeas.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {ko ? "추가하면 좋은 FAQ" : "FAQ ideas"}
                        </p>
                        <ul className="mt-1 space-y-1 text-xs leading-relaxed text-muted">
                          {analysis.faqIdeas.map((f, i) => (
                            <li key={i}>
                              <b className="text-foreground">Q.</b> {f.q}
                              <br />
                              <b className="text-foreground">A.</b> {f.a}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-[11px] text-muted">
                          {ko
                            ? "아래 FAQ 생성 도구로 추가하면 FAQPage 구조화 데이터로 노출됩니다."
                            : "Add via the FAQ tool below to publish as FAQPage data."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-muted">
            {ko
              ? "점수·제안은 참고용입니다. 키워드를 억지로 반복하면 오히려 감점되며, 독자에게 유용한 글이 가장 좋은 SEO입니다."
              : "Scores and suggestions are a guide — genuinely useful content is the best SEO."}
          </p>
        </div>
      )}
    </div>
  );
}

function Suggestion({
  label,
  text,
  applied,
  busy,
  applyLabel,
  onApply,
  note,
}: {
  label: string;
  text: string;
  applied: boolean;
  busy: boolean;
  applyLabel: string;
  onApply: () => void;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <button
          type="button"
          onClick={onApply}
          disabled={busy || applied}
          className="shrink-0 rounded-md border border-primary/40 px-2 py-0.5 text-[11px] font-medium text-primary disabled:opacity-50"
        >
          {applied ? "✓" : ""} {applyLabel}
        </button>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted">{text}</p>
      {note && <p className="mt-0.5 text-[11px] text-muted">{note}</p>}
    </div>
  );
}
