"use client";

import { useMemo } from "react";
import { scanAdRisk, isThinContent } from "@/lib/blog/adRiskScan";

/**
 * 글 편집기 — 광고 게재 검수·검색 품질에서 걸리기 쉬운 표현을 작성 중에 알려준다(참고용).
 * 서버 검수(관리자 광고 검수 탭)와 같은 규칙(adRiskScan)을 쓴다.
 */
export function AdRiskHints({ content, ko = true }: { content: string; ko?: boolean }) {
  const risks = useMemo(() => scanAdRisk(content), [content]);
  const thin = useMemo(() => isThinContent(content), [content]);
  if (risks.length === 0 && !thin) return null;
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs">
      <p className="font-semibold">
        {ko ? "🔎 발행 전 점검 — 근거·사례 표기" : "🔎 Pre-publish check"}
      </p>
      <p className="mt-0.5 text-muted">
        {ko
          ? "검수된 글에만 광고가 실리고 검색에서도 신뢰도가 평가돼요. 아래 표현은 근거를 붙이거나 고쳐주세요."
          : "Only reviewed posts carry ads and search engines evaluate trust. Add evidence or rewrite the items below."}
      </p>
      <ul className="mt-2 space-y-1">
        {thin && (
          <li className="rounded-lg bg-white/70 px-2.5 py-1.5">
            <b>{ko ? "분량 부족" : "Thin content"}</b>
            <span className="ml-1 text-muted">
              {ko
                ? "— 본문이 600자 미만이에요. 독자가 바로 쓸 수 있는 단계·예시·사진 설명을 더해주세요."
                : "— under 600 characters. Add steps, examples or photo descriptions readers can use."}
            </span>
          </li>
        )}
        {risks.map((x) => (
          <li key={x.key} className="rounded-lg bg-white/70 px-2.5 py-1.5">
            <b>{x.label}</b>: {x.matches.map((m) => `"${m}"`).join(", ")}
            <span className="ml-1 text-muted">— {x.advice}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
