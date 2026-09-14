"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  setMarketerAction,
  saveMarketerRewardAction,
  generateSettlementsAction,
  markSettlementPaidAction,
} from "@/app/dashboard/admin/actions";

type Rank = "RESELLER" | "MAKER";

export interface AdminMarketerItem {
  userId: string;
  name: string;
  email: string;
  status: string;
  payoutType: string;
  rank: Rank;
  activeClients: number;
  pendingCommission: number;
}
export interface RewardItem {
  itemType: "subscription_plan" | "product";
  itemKey: string;
  rank: string;
  amount: number;
  active: boolean;
}
export interface RewardTarget {
  itemType: "subscription_plan" | "product";
  itemKey: string;
  label: string;
  price: number | null;
}
export interface SettlementItem {
  id: string;
  name: string;
  email: string;
  period: string;
  gross: number;
  tax: number;
  net: number;
  count: number;
  status: string;
  payoutType: string;
}

function won(n: number) {
  return `₩${n.toLocaleString()}`;
}

// ---------------- 마케터 지정/목록 ----------------

export function AdminMarketers({ marketers }: { marketers: AdminMarketerItem[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [email, setEmail] = useState("");
  const [payoutType, setPayoutType] = useState<"freelancer" | "business">(
    "freelancer",
  );
  const [note, setNote] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote(res.error ?? res.message ?? null);
      if (!res.error) router.refresh();
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">마케터 관리</h2>
      <p className="text-xs text-muted">
        유저를 마케터로 지정하면 마케터 전용 대시보드가 열리고, 추천 링크로 영업할 수 있습니다.
        직급은 유지중 정기결제 클라이언트 10명 이상이면 자동 MAKER가 됩니다.
      </p>
      {note && <p className="text-sm text-primary">{note}</p>}

      <Card className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs text-muted">이메일</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">정산 유형</label>
          <Select
            value={payoutType}
            onChange={(e) =>
              setPayoutType(e.target.value as "freelancer" | "business")
            }
            className="w-36"
          >
            <option value="freelancer">프리랜서(3.3%)</option>
            <option value="business">사업자(계산서)</option>
          </Select>
        </div>
        <Button
          onClick={() => run(() => setMarketerAction(email, true, payoutType))}
          disabled={busy || !email.trim()}
        >
          {busy ? <Spinner className="size-4" /> : "마케터 지정"}
        </Button>
      </Card>

      {marketers.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="p-3">마케터</th>
                <th className="p-3">직급</th>
                <th className="p-3 text-right">유지 클라이언트</th>
                <th className="p-3">정산유형</th>
                <th className="p-3 text-right">미정산 수당</th>
                <th className="p-3">상태</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {marketers.map((m) => (
                <tr key={m.userId} className="border-b border-border/60 last:border-0">
                  <td className="p-3">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted">{m.email}</p>
                  </td>
                  <td className="p-3">
                    <Badge tone={m.rank === "MAKER" ? "success" : "default"}>
                      {m.rank}
                    </Badge>
                  </td>
                  <td className="tnum p-3 text-right">{m.activeClients}</td>
                  <td className="p-3 text-xs">
                    {m.payoutType === "freelancer" ? "프리랜서" : "사업자"}
                  </td>
                  <td className="tnum p-3 text-right">{won(m.pendingCommission)}</td>
                  <td className="p-3">
                    <Badge tone={m.status === "active" ? "success" : "muted"}>
                      {m.status === "active" ? "활성" : "해제됨"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {m.status === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            setMarketerAction(
                              m.email,
                              false,
                              m.payoutType as "freelancer" | "business",
                            ),
                          )
                        }
                      >
                        해제
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            setMarketerAction(
                              m.email,
                              true,
                              m.payoutType as "freelancer" | "business",
                            ),
                          )
                        }
                      >
                        재지정
                      </Button>
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

// ---------------- 직급별 수당 정책 ----------------

export function AdminMarketerRewards({
  targets,
  rewards,
}: {
  targets: RewardTarget[];
  rewards: RewardItem[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  // key: itemType:itemKey:rank
  const rewardMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rewards)
      m.set(`${r.itemType}:${r.itemKey}:${r.rank}`, r.active ? r.amount : 0);
    return m;
  }, [rewards]);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const valOf = (t: RewardTarget, rank: Rank) => {
    const key = `${t.itemType}:${t.itemKey}:${rank}`;
    return edits[key] ?? String(rewardMap.get(key) ?? 0);
  };
  const setVal = (t: RewardTarget, rank: Rank, v: string) =>
    setEdits((p) => ({ ...p, [`${t.itemType}:${t.itemKey}:${rank}`]: v }));

  const save = (t: RewardTarget) =>
    start(async () => {
      setNote(null);
      const reseller = Number(valOf(t, "RESELLER"));
      const maker = Number(valOf(t, "MAKER"));
      const r1 = await saveMarketerRewardAction(
        t.itemType,
        t.itemKey,
        "RESELLER",
        reseller,
        reseller > 0,
      );
      const r2 = await saveMarketerRewardAction(
        t.itemType,
        t.itemKey,
        "MAKER",
        maker,
        maker > 0,
      );
      setNote(r1.error ?? r2.error ?? "수당이 저장되었습니다.");
      if (!r1.error && !r2.error) router.refresh();
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">직급별 영업 수당</h2>
      <p className="text-xs text-muted">
        상품/플랜별로 리셀러·메이커 수당을 원 단위로 설정합니다. 0원이면 수당 없음. 판매 시점 금액이
        기록되므로, 금액을 바꿔도 과거 수당은 유지됩니다.
      </p>
      {note && <p className="text-sm text-primary">{note}</p>}
      <Card className="divide-y divide-border p-0">
        {targets.map((t) => (
          <div
            key={`${t.itemType}:${t.itemKey}`}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="min-w-[140px]">
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted">
                {t.itemType === "subscription_plan" ? "구독 플랜" : "상품"}
                {t.price != null ? ` · ${won(t.price)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm">
                <span className="text-xs text-muted">리셀러</span>
                <Input
                  type="number"
                  min={0}
                  value={valOf(t, "RESELLER")}
                  onChange={(e) => setVal(t, "RESELLER", e.target.value)}
                  className="w-24 text-right"
                />
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <span className="text-xs text-muted">메이커</span>
                <Input
                  type="number"
                  min={0}
                  value={valOf(t, "MAKER")}
                  onChange={(e) => setVal(t, "MAKER", e.target.value)}
                  className="w-24 text-right"
                />
              </label>
              <Button size="sm" onClick={() => save(t)} disabled={busy}>
                저장
              </Button>
            </div>
          </div>
        ))}
        {targets.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">
            설정할 플랜/상품이 없습니다.
          </p>
        )}
      </Card>
    </section>
  );
}

// ---------------- 정산 ----------------

export function AdminSettlements({
  settlements,
}: {
  settlements: SettlementItem[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const [note, setNote] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote(res.error ?? res.message ?? null);
      if (!res.error) router.refresh();
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">마케터 정산</h2>
      <p className="text-xs text-muted">
        월을 선택해 정산을 생성하면 해당 월의 미정산 수당이 마케터별로 마감됩니다. 프리랜서는 3.3%
        원천징수 후 순액이 계산됩니다. 실지급 후 “지급완료”로 표시하세요.
      </p>
      {note && <p className="text-sm text-primary">{note}</p>}

      <Card className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted">정산 월</label>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-44"
          />
        </div>
        <Button
          onClick={() => run(() => generateSettlementsAction(period))}
          disabled={busy}
        >
          {busy ? <Spinner className="size-4" /> : "정산 생성/마감"}
        </Button>
      </Card>

      {settlements.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="p-3">정산월</th>
                <th className="p-3">마케터</th>
                <th className="p-3">유형</th>
                <th className="p-3 text-right">건수</th>
                <th className="p-3 text-right">수당합계</th>
                <th className="p-3 text-right">원천징수</th>
                <th className="p-3 text-right">실지급</th>
                <th className="p-3">상태</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 whitespace-nowrap">{s.period}</td>
                  <td className="p-3">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted">{s.email}</p>
                  </td>
                  <td className="p-3 text-xs">
                    {s.payoutType === "freelancer" ? "프리랜서" : "사업자"}
                  </td>
                  <td className="tnum p-3 text-right">{s.count}</td>
                  <td className="tnum p-3 text-right">{won(s.gross)}</td>
                  <td className="tnum p-3 text-right text-muted">
                    {s.tax > 0 ? `-${won(s.tax)}` : "-"}
                  </td>
                  <td className="tnum p-3 text-right font-medium">{won(s.net)}</td>
                  <td className="p-3">
                    <Badge tone={s.status === "paid" ? "success" : "warning"}>
                      {s.status === "paid" ? "지급완료" : "정산중"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {s.status !== "paid" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `${s.name} · ${s.period} 정산을 지급완료로 표시할까요? (실지급: ${won(s.net)})`,
                            )
                          )
                            run(() => markSettlementPaidAction(s.id));
                        }}
                      >
                        지급완료
                      </Button>
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
