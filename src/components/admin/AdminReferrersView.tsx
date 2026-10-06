"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Field";
import type { ReferrerStats } from "@/lib/admin/referrers";

function pct(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

export function AdminReferrersView({ data }: { data: ReferrerStats }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data.rows;
    return data.rows.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.email.toLowerCase().includes(term),
    );
  }, [data.rows, q]);

  const overallRate =
    data.totalSignups > 0 ? data.totalConversions / data.totalSignups : 0;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">추천인별 통계</h2>
        <p className="text-sm text-muted">
          추천인 <b className="tnum text-foreground">{data.referrerCount.toLocaleString()}</b>명
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-surface p-3">
          <p className="text-xs text-muted">추천 가입</p>
          <p className="tnum text-xl font-semibold">
            {data.totalSignups.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3">
          <p className="text-xs text-muted">유료 전환</p>
          <p className="tnum text-xl font-semibold text-success">
            {data.totalConversions.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3">
          <p className="text-xs text-muted">전환율</p>
          <p className="tnum text-xl font-semibold">{pct(overallRate)}</p>
        </div>
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="추천인 이메일 / 이름 검색"
        className="max-w-xs"
      />

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          {data.rows.length === 0
            ? "추천 가입 내역이 없습니다."
            : "검색 결과가 없습니다."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="p-3">추천인</th>
                <th className="p-3 text-right">추천 가입</th>
                <th className="p-3 text-right">유료 전환</th>
                <th className="p-3 text-right">전환율</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.referrerUserId}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="p-3">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted">{r.email || "-"}</p>
                  </td>
                  <td className="tnum p-3 text-right">{r.signups}</td>
                  <td className="tnum p-3 text-right text-success">
                    {r.conversions}
                  </td>
                  <td className="tnum p-3 text-right text-muted">
                    {r.signups > 0 ? pct(r.conversionRate) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
