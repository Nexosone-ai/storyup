"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import {
  reviewCampaignAction,
  setAdFeeAction,
  generateAdSettlementsAction,
  markAdSettlementPaidAction,
} from "@/app/dashboard/admin/actions";

const won = (n: number) => `₩${n.toLocaleString()}`;

export interface AdminCampaign {
  id: string;
  name: string;
  type: string;
  businessName: string;
  status: string;
  bidAmount: number;
  totalBudget: number;
  spent: number;
  balance: number;
  targetUrl: string;
}
export interface AdSettlementItem {
  id: string;
  name: string;
  email: string;
  period: string;
  gross: number;
  tax: number;
  net: number;
  count: number;
  status: string;
}

export function AdminAdsView({
  campaigns,
  feePct,
  settlements,
}: {
  campaigns: AdminCampaign[];
  feePct: number;
  settlements: AdSettlementItem[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [fee, setFee] = useState(String(feePct));
  const now = new Date();
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote(res.error ?? res.message ?? null);
      if (!res.error) router.refresh();
    });

  const pending = campaigns.filter((c) => c.status === "pending_review");

  return (
    <div className="space-y-8">
      {note && <p className="text-sm text-primary">{note}</p>}

      {/* 수수료 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">플랫폼 수수료</h2>
        <Card className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">수수료 %</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="w-24 text-right"
            />
          </label>
          <Button size="sm" disabled={busy} onClick={() => run(() => setAdFeeAction(Number(fee)))}>
            저장
          </Button>
          <p className="w-full text-xs text-muted">
            광고주 클릭 지출의 {fee}%가 플랫폼 수익, 나머지가 블로거 수익으로 적립됩니다.
          </p>
        </Card>
      </section>

      {/* 검수 대기 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">검수 대기 ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-muted">
            검수할 캠페인이 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {pending.map((c) => (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted">
                    <span className="uppercase">{c.type}</span> · {c.businessName} · 단가 {won(c.bidAmount)} · 예산 {won(c.totalBudget)} · 잔액 {won(c.balance)}
                  </p>
                  <a href={c.targetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                    {c.targetUrl}
                  </a>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => run(() => reviewCampaignAction(c.id, true))}>
                    승인
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy}
                    onClick={() => run(() => reviewCampaignAction(c.id, false, "반려"))}>
                    <span className="text-danger">반려</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 전체 캠페인 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">전체 캠페인 ({campaigns.length})</h2>
        {campaigns.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="p-3">캠페인</th>
                  <th className="p-3">광고주</th>
                  <th className="p-3">상태</th>
                  <th className="p-3 text-right">단가/예산</th>
                  <th className="p-3 text-right">지출</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-xs">{c.businessName}</td>
                    <td className="p-3"><Badge tone="muted">{c.status}</Badge></td>
                    <td className="tnum p-3 text-right">{won(c.bidAmount)}/{won(c.totalBudget)}</td>
                    <td className="tnum p-3 text-right">{won(c.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 정산 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">광고 수익 정산</h2>
        <Card className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">정산 월</span>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" />
          </label>
          <Button size="sm" disabled={busy} onClick={() => run(() => generateAdSettlementsAction(period))}>
            정산 생성/마감
          </Button>
        </Card>
        {settlements.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="p-3">월</th>
                  <th className="p-3">블로거</th>
                  <th className="p-3 text-right">건수</th>
                  <th className="p-3 text-right">수익</th>
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
                    <td className="tnum p-3 text-right">{s.count}</td>
                    <td className="tnum p-3 text-right">{won(s.gross)}</td>
                    <td className="tnum p-3 text-right text-muted">{s.tax > 0 ? `-${won(s.tax)}` : "-"}</td>
                    <td className="tnum p-3 text-right font-medium">{won(s.net)}</td>
                    <td className="p-3">
                      <Badge tone={s.status === "paid" ? "success" : "warning"}>
                        {s.status === "paid" ? "지급완료" : "정산중"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {s.status !== "paid" && (
                        <Button size="sm" variant="outline" disabled={busy}
                          onClick={() => {
                            if (window.confirm(`${s.name} · ${s.period} 지급완료 처리? (실지급 ${won(s.net)})`))
                              run(() => markAdSettlementPaidAction(s.id));
                          }}>
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
    </div>
  );
}
