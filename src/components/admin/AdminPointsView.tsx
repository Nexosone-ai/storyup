"use client";

import { useMemo, useState } from "react";
import { Card, Badge } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import type { AdminPointsLedger } from "@/lib/admin/points";

/** 유형 라벨/색 — 적립(+)은 success, 사용·회수(−)는 danger 톤. */
const TYPE_META: Record<
  string,
  { label: string; tone: "success" | "danger" | "muted" | "primary" }
> = {
  REWARD: { label: "보상 적립", tone: "success" },
  PLAN_CREDIT: { label: "플랜 크레딧", tone: "primary" },
  ADMIN_CREDIT: { label: "관리자 지급", tone: "primary" },
  PURCHASE: { label: "충전", tone: "success" },
  BONUS: { label: "충전 보너스", tone: "success" },
  REFUND: { label: "환불·회수", tone: "muted" },
  AI_USAGE: { label: "AI 사용", tone: "danger" },
};

function typeLabel(t: string | null): string {
  if (!t) return "기타";
  return TYPE_META[t]?.label ?? t;
}
function typeTone(t: string | null): "success" | "danger" | "muted" | "primary" {
  if (!t) return "muted";
  return TYPE_META[t]?.tone ?? "muted";
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function signed(n: number) {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString()}`;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger" | "foreground";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : "text-foreground";
  return (
    <Card className="space-y-1">
      <p className="text-xs text-muted">{label}</p>
      <p className={`tnum text-xl font-semibold tracking-tight ${color}`}>
        {value}
      </p>
    </Card>
  );
}

export function AdminPointsView({ ledger }: { ledger: AdminPointsLedger }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");

  const types = useMemo(
    () => ledger.byType.map((t) => t.type),
    [ledger.byType],
  );

  const filtered = useMemo(
    () =>
      ledger.txns.filter(
        (t) =>
          (type === "ALL" || t.type === type) &&
          (!q.trim() ||
            t.email.toLowerCase().includes(q.trim().toLowerCase()) ||
            t.name.toLowerCase().includes(q.trim().toLowerCase()) ||
            (t.reason ?? "").toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [ledger.txns, q, type],
  );

  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">포인트 내역</h2>
        <p className="text-sm text-muted">
          총{" "}
          <b className="tnum text-foreground">
            {ledger.totalCount.toLocaleString()}
          </b>
          건
          {ledger.txns.length < ledger.totalCount && (
            <span className="ml-1 text-xs">
              (최근 {ledger.txns.length.toLocaleString()}건 표시)
            </span>
          )}
        </p>
      </div>

      {/* 전 기간 요약 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="총 적립 (입금)"
          value={signed(ledger.totalIn)}
          tone="success"
        />
        <Stat
          label="총 사용·회수 (출금)"
          value={signed(-ledger.totalOut)}
          tone="danger"
        />
        <Stat
          label="순 잔액 (전체 미사용)"
          value={ledger.netBalance.toLocaleString()}
        />
      </div>

      {/* 유형별 집계 */}
      <div>
        <p className="mb-2 text-sm font-medium text-muted">유형별 합계</p>
        <div className="flex flex-wrap gap-2">
          {ledger.byType.map((t) => (
            <div
              key={t.type}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            >
              <Badge tone={typeTone(t.type)}>{typeLabel(t.type)}</Badge>
              <span
                className={`tnum font-semibold ${t.total >= 0 ? "text-success" : "text-danger"}`}
              >
                {signed(t.total)}
              </span>
              <span className="tnum text-xs text-muted">({t.count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-40"
        >
          <option value="ALL">전체 유형</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이메일 / 이름 / 사유 검색"
          className="max-w-xs"
        />
      </div>

      {/* 거래 목록 */}
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          {ledger.txns.length === 0
            ? "거래 내역이 없습니다."
            : "검색 결과가 없습니다."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="p-3">일시</th>
                <th className="p-3">회원</th>
                <th className="p-3">유형</th>
                <th className="p-3">사유</th>
                <th className="p-3 text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="p-3 whitespace-nowrap text-muted">
                    {fmtDateTime(t.createdAt)}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted">{t.email || "-"}</p>
                  </td>
                  <td className="p-3">
                    <Badge tone={typeTone(t.type)}>{typeLabel(t.type)}</Badge>
                  </td>
                  <td className="p-3 text-muted">{t.reason || "-"}</td>
                  <td
                    className={`tnum p-3 text-right font-semibold whitespace-nowrap ${
                      t.amount >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {signed(t.amount)}
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
