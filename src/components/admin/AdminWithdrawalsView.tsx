"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import type { AdminWithdrawals } from "@/lib/admin/withdrawals";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminWithdrawalsView({
  data,
}: {
  data: AdminWithdrawals;
}) {
  const [q, setQ] = useState("");
  const [onlyReason, setOnlyReason] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (onlyReason && !r.reason?.trim()) return false;
      if (!term) return true;
      return (
        (r.email ?? "").toLowerCase().includes(term) ||
        (r.name ?? "").toLowerCase().includes(term) ||
        (r.reason ?? "").toLowerCase().includes(term)
      );
    });
  }, [data.rows, q, onlyReason]);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">회원탈퇴</h2>
        <p className="text-sm text-muted">
          총 <b className="tnum text-foreground">{data.totalCount.toLocaleString()}</b>건
          <span className="ml-1 text-xs">
            (사유 작성 {data.withReasonCount.toLocaleString()}건)
          </span>
          {data.rows.length < data.totalCount && (
            <span className="ml-1 text-xs">· 최근 {data.rows.length}건 표시</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이메일 / 이름 / 사유 검색"
          className="max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={onlyReason}
            onChange={(e) => setOnlyReason(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          사유 있는 것만
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          {data.rows.length === 0 ? "탈퇴 내역이 없습니다." : "검색 결과가 없습니다."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="p-3 whitespace-nowrap">탈퇴일시</th>
                <th className="p-3">회원</th>
                <th className="p-3">탈퇴 사유</th>
                <th className="p-3 text-right whitespace-nowrap">결제이력</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/60 align-top last:border-0"
                >
                  <td className="p-3 whitespace-nowrap text-muted">
                    {fmtDate(r.deletedAt)}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{r.name || "이름 없음"}</p>
                    <p className="text-xs text-muted">{r.email || "-"}</p>
                  </td>
                  <td className="p-3">
                    {r.reason?.trim() ? (
                      <span className="whitespace-pre-wrap text-foreground">
                        {r.reason}
                      </span>
                    ) : (
                      <span className="text-muted">미작성</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {r.hadPayments ? (
                      <Badge tone="warning">있음</Badge>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
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
