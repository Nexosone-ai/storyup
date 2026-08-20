"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { requestWithdrawal } from "@/app/dashboard/points/actions";
import type { PointTx, Withdrawal } from "@/lib/points";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

const STATUS: Record<string, { label: string; tone: "success" | "muted" | "warning" }> =
  {
    pending: { label: "대기 중", tone: "warning" },
    approved: { label: "승인됨", tone: "success" },
    rejected: { label: "반려됨", tone: "muted" },
  };

export function PointsView({
  balance,
  transactions,
  withdrawals,
}: {
  balance: number;
  transactions: PointTx[];
  withdrawals: Withdrawal[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await requestWithdrawal(Number(amount), account);
      if (res.error) setError(res.error);
      else {
        setAmount("");
        setAccount("");
        router.refresh();
      }
    });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="eyebrow mb-2">포인트</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          포인트 지갑
        </h1>
      </div>

      <Card className="bg-primary text-primary-foreground">
        <p className="text-sm opacity-85">보유 포인트</p>
        <p className="tnum mt-1 text-4xl font-bold">
          {balance.toLocaleString()} P
        </p>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">출금 요청</h2>
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="wd-amount">출금 포인트</Label>
              <Input
                id="wd-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="예: 10000"
              />
            </div>
            <div>
              <Label htmlFor="wd-acc">정산 계좌</Label>
              <Input
                id="wd-acc"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="은행 / 계좌번호 / 예금주"
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? <Spinner className="size-4" /> : "출금 요청"}
          </Button>
        </Card>

        {withdrawals.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {withdrawals.map((w) => (
              <li key={w.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="tnum font-medium">
                    {w.amount.toLocaleString()} P
                  </p>
                  <p className="text-xs text-muted">{fmtDate(w.created_at)}</p>
                </div>
                <Badge tone={STATUS[w.status]?.tone ?? "muted"}>
                  {STATUS[w.status]?.label ?? w.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">거래 내역</h2>
        {transactions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            아직 거래 내역이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.reason}</p>
                  <p className="text-xs text-muted">{fmtDate(t.created_at)}</p>
                </div>
                <span
                  className={`tnum font-semibold ${t.amount >= 0 ? "text-primary" : "text-danger"}`}
                >
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount.toLocaleString()} P
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
