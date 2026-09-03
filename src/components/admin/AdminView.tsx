"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { grantPoints, setUserPlanAction } from "@/app/dashboard/admin/actions";
import { PLANS } from "@/lib/plans";

export function AdminView() {
  const router = useRouter();
  const [busy, start] = useTransition();

  // grant form
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // plan form
  const [planEmail, setPlanEmail] = useState("");
  const [plan, setPlan] = useState("basic");
  const [planNote, setPlanNote] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const applyPlan = () =>
    start(async () => {
      setPlanNote(null);
      setPlanError(null);
      const res = await setUserPlanAction(planEmail, plan);
      if (res.error) setPlanError(res.error);
      else {
        setPlanNote(res.message ?? "반영되었습니다.");
        setPlanEmail("");
        router.refresh();
      }
    });

  const grant = () =>
    start(async () => {
      setNote(null);
      setError(null);
      const res = await grantPoints(email, Number(amount), reason);
      if (res.error) setError(res.error);
      else {
        setNote(res.message ?? "반영되었습니다.");
        setEmail("");
        setAmount("");
        setReason("");
        router.refresh();
      }
    });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="eyebrow mb-2">관리자</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          운영 관리
        </h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">포인트 지급 / 차감</h2>
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <Label htmlFor="g-email">사용자 이메일</Label>
              <Input
                id="g-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="g-amount">포인트 (음수=차감)</Label>
              <Input
                id="g-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="예: 10000"
              />
            </div>
            <div>
              <Label htmlFor="g-reason">사유</Label>
              <Input
                id="g-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예: 이벤트 보상"
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {note && <p className="text-sm text-primary">{note}</p>}
          <Button size="sm" onClick={grant} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : "반영"}
          </Button>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">플랜 관리</h2>
        <Card className="space-y-3">
          <p className="text-xs text-muted">
            정기결제 오픈 전까지 유료 플랜은 여기서 수동으로 부여합니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="p-email">사용자 이메일</Label>
              <Input
                id="p-email"
                value={planEmail}
                onChange={(e) => setPlanEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="p-plan">플랜</Label>
              <select
                id="p-plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name.ko}
                    {p.priceKrw
                      ? ` (₩${p.priceKrw.toLocaleString()}/월)`
                      : p.priceKrw === 0
                        ? " (무료)"
                        : " (협의)"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {planError && <p className="text-sm text-danger">{planError}</p>}
          {planNote && <p className="text-sm text-primary">{planNote}</p>}
          <Button size="sm" onClick={applyPlan} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : "플랜 변경"}
          </Button>
        </Card>
      </section>
    </div>
  );
}
