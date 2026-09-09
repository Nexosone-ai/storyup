"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { PLANS } from "@/lib/plans";
import type { AdminMember } from "@/lib/admin/members";

const PLAN_LABEL = new Map<string, string>(
  PLANS.map((p) => [p.id, p.name.ko]),
);

function planLabel(plan: string): string {
  return PLAN_LABEL.get(plan) ?? plan;
}

function planTone(plan: string): "success" | "muted" {
  return plan && plan !== "free" ? "success" : "muted";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminMembers({
  members,
  total,
}: {
  members: AdminMember[];
  total: number;
}) {
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("ALL");

  const filtered = useMemo(
    () =>
      members.filter(
        (m) =>
          (plan === "ALL" ||
            (plan === "free" ? m.plan === "free" || !m.plan : m.plan === plan)) &&
          (!q.trim() ||
            m.email.toLowerCase().includes(q.trim().toLowerCase()) ||
            m.name.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [members, q, plan],
  );

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">회원 관리</h2>
        <p className="text-sm text-muted">
          총 <b className="tnum text-foreground">{total.toLocaleString()}</b>명
          {members.length < total && (
            <span className="ml-1 text-xs">(최근 {members.length}명 표시)</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="w-40"
        >
          <option value="ALL">전체 플랜</option>
          {PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name.ko}
            </option>
          ))}
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이메일 / 이름 검색"
          className="max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          {members.length === 0
            ? "회원이 없습니다."
            : "검색 결과가 없습니다."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="p-3">가입일</th>
                <th className="p-3">회원</th>
                <th className="p-3">플랜</th>
                <th className="p-3 text-right">비즈니스</th>
                <th className="p-3 text-right">누적 결제</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr
                  key={m.userId}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="p-3 whitespace-nowrap text-muted">
                    {fmtDate(m.createdAt)}
                  </td>
                  <td className="p-3">
                    <p className="flex items-center gap-1.5 font-medium">
                      {m.name}
                      {m.isAdmin && <Badge tone="warning">관리자</Badge>}
                    </p>
                    <p className="text-xs text-muted">{m.email || "-"}</p>
                  </td>
                  <td className="p-3">
                    <Badge tone={planTone(m.plan)}>{planLabel(m.plan)}</Badge>
                  </td>
                  <td className="tnum p-3 text-right">{m.businessCount}</td>
                  <td className="tnum p-3 text-right">
                    {m.paidTotal > 0
                      ? `₩${m.paidTotal.toLocaleString()}`
                      : "-"}
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
