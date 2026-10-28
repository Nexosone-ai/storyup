"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type IndustrySummary,
  industryName,
  industrySummaryText,
} from "@/lib/industries/labels";

/**
 * 업종 탐색 — 검색 + 카드 그리드 + '업종 추가 요청'.
 * 카드 전체가 링크(키보드 접근·포커스 링), 모바일에서도 검색·탐색·요청이 쉽게 되도록.
 */
export function IndustriesGrid({
  industries,
  ko,
  requestHref,
}: {
  industries: IndustrySummary[];
  ko: boolean;
  requestHref: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return industries;
    return industries.filter((i) => {
      const hay = `${i.nameKo} ${i.nameEn} ${i.summaryKo} ${i.summaryEn} ${i.slug}`.toLowerCase();
      return hay.includes(term);
    });
  }, [q, industries]);

  return (
    <div>
      <div className="mx-auto max-w-md">
        <label className="sr-only" htmlFor="industry-search">
          {ko ? "업종 검색" : "Search industries"}
        </label>
        <input
          id="industry-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ko ? "업종명으로 검색 (예: 카페, 병원)" : "Search by industry"}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {filtered.length > 0 ? (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => (
            <li key={i.id}>
              <Link
                href={`/industries/${i.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span aria-hidden className="text-3xl">
                  {i.icon}
                </span>
                <span className="mt-3 text-lg font-semibold text-foreground">
                  {industryName(i, ko)}
                </span>
                <span className="mt-1.5 flex-1 text-sm text-muted">
                  {industrySummaryText(i, ko)}
                </span>
                <span className="mt-3 text-sm font-medium text-primary group-hover:underline">
                  {ko ? "자세히 보기 →" : "Learn more →"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">
            {ko
              ? `'${q}'에 맞는 업종을 찾지 못했어요.`
              : `No industry matched '${q}'.`}
          </p>
        </div>
      )}

      {/* 하단 및 검색 결과 없음 영역: 업종 추가 요청 */}
      <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-muted p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          {ko ? "찾는 업종이 없나요?" : "Can't find your industry?"}
        </p>
        <p className="max-w-md text-sm text-muted">
          {ko
            ? "원하는 업종을 알려주시면 검토 후 반영 여부를 안내해드려요."
            : "Tell us your industry and we'll review it."}
        </p>
        <Link
          href={requestHref}
          className="neon-glow inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {ko ? "업종 추가 요청" : "Request an industry"}
        </Link>
      </div>
    </div>
  );
}
