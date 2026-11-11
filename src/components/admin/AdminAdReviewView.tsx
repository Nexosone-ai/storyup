"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { setAdReviewAction } from "@/app/dashboard/admin/ad-review/actions";
import type { AdReviewRow, AdReviewStatus } from "@/lib/adReview";

const STATUS_LABEL: Record<AdReviewStatus | "all", string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  all: "전체",
};

/**
 * 관리자 — 광고 게재 검수. 글마다 자동 점검 신호(가상 사례·보장·투자·건강·인증·출처 없는 수치)와
 * 분량을 보여주고, 공개 페이지를 확인한 뒤 승인/반려한다. 승인 글에만 회사 광고가 나온다.
 */
export function AdminAdReviewView({
  rows,
  status,
  summary,
}: {
  rows: AdReviewRow[];
  status: AdReviewStatus | "all";
  summary: { pending: number; approved: number; rejected: number };
}) {
  const [list, setList] = useState(rows);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const act = (row: AdReviewRow, next: AdReviewStatus) => {
    setBusyId(row.id);
    setError(null);
    const publicPath = row.siteSlug ? `/site/${row.siteSlug}/blog/${row.slug}` : null;
    startTransition(async () => {
      const res = await setAdReviewAction(row.id, next, note[row.id] ?? "", publicPath);
      if (res.error) setError(res.error);
      else
        setList((l) =>
          status === "all"
            ? l.map((r) => (r.id === row.id ? { ...r, adReviewStatus: next } : r))
            : l.filter((r) => r.id !== row.id),
        );
      setBusyId(null);
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">광고 게재 검수</h2>
        <p className="mt-1 text-sm text-muted">
          이용자가 발행한 글은 바로 공개되지만, 회사(STORYUP) 애드센스 광고는 <b>검수에서 승인한
          글</b>과 승인 글이 1개 이상인 사이트의 홈·블로그 목록에만 실립니다(무료 플랜 사이트만
          회사 광고 대상). 자동 점검은 참고용이니 공개 페이지를 열어 사실·근거·사례 표기를 직접
          확인하세요. 유료 사용자의 본인 애드센스는 이 검수와 무관합니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/dashboard/admin/ad-review?status=${s}`}
            className={`rounded-full border px-3 py-1 ${
              status === s
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {STATUS_LABEL[s]}
            {s !== "all" && (
              <span className="ml-1 tabular-nums">
                {summary[s]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          {STATUS_LABEL[status]} 상태의 글이 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const publicHref = r.siteSlug ? `/site/${r.siteSlug}/blog/${r.slug}` : null;
            const high = r.risks.filter((x) => x.severity === "high");
            return (
              <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {publicHref ? (
                        <a
                          href={publicHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {r.title}
                        </a>
                      ) : (
                        r.title
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.businessName}
                      {r.ownerEmail ? ` · ${r.ownerEmail}` : ""} ·{" "}
                      <span className={r.ownerPlan === "free" ? "text-primary" : ""}>
                        {r.ownerPlan === "free" ? "무료(회사 광고 대상)" : `${r.ownerPlan} 플랜`}
                      </span>
                      {" · "}
                      {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString("ko-KR") : ""}
                      {" · "}
                      <span className={r.thin ? "text-danger" : ""}>
                        {r.chars.toLocaleString()}자{r.thin ? " (분량 부족)" : ""}
                      </span>
                      {!r.siteSlug && " · 사이트 미게시"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.adReviewStatus === "approved"
                        ? "bg-success/15 text-success"
                        : r.adReviewStatus === "rejected"
                          ? "bg-danger/10 text-danger"
                          : "bg-surface-2 text-muted"
                    }`}
                  >
                    {STATUS_LABEL[r.adReviewStatus]}
                  </span>
                </div>

                {r.risks.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 text-xs">
                    {r.risks.map((x) => (
                      <li
                        key={x.key}
                        className={`rounded-lg px-2.5 py-1.5 ${
                          x.severity === "high" ? "bg-danger/10" : "bg-warning/10"
                        }`}
                      >
                        <b>{x.label}</b>: {x.matches.map((m) => `"${m}"`).join(", ")}
                        <span className="ml-1 text-muted">— {x.advice}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-muted">자동 점검 신호 없음 — 공개 페이지에서 내용을 확인하세요.</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={note[r.id] ?? r.adReviewNote ?? ""}
                    onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="메모(반려 사유·수정 요청 등, 선택)"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                  />
                  {r.adReviewStatus !== "approved" && (
                    <Button
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => act(r, "approved")}
                      title={high.length > 0 ? "높은 위험 신호가 있어요 — 확인 후 승인하세요" : undefined}
                    >
                      승인
                    </Button>
                  )}
                  {r.adReviewStatus !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => act(r, "rejected")}
                    >
                      반려
                    </Button>
                  )}
                  {r.adReviewStatus !== "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === r.id}
                      onClick={() => act(r, "pending")}
                    >
                      대기로
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
