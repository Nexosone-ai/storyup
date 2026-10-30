"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  setEarningStatusAction,
  reprocessInvoiceAction,
} from "@/app/dashboard/admin/partner-sales/actions";
import type {
  AdminInvoiceView,
  AdminSettlementView,
  AdminB2b2cStats,
} from "@/lib/b2b2c/admin";

const won = (n: number | null) => `₩${(n ?? 0).toLocaleString()}`;

const INV_STATUS: Record<string, string> = {
  issued: "발행",
  pending_payment: "결제대기",
  paid: "결제완료",
  void: "무효",
  refunded: "환불",
};
const SET_STATUS: Record<string, string> = {
  pending: "정산대기",
  held: "보류",
  paid: "지급완료",
};

export function AdminPartnerSalesView({
  enabled,
  invoices,
  settlements,
  stats,
}: {
  enabled: boolean;
  invoices: AdminInvoiceView[];
  settlements: AdminSettlementView[];
  stats: AdminB2b2cStats;
}) {
  const [tab, setTab] = useState<"invoices" | "settlements">("invoices");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold">파트너 판매 · 정산</h2>
        <p className="mt-1 text-sm text-muted">
          파트너·고객·상품·기본요금·판매가·수납·정산을 연결해 감사합니다.
          {!enabled && (
            <span className="ml-1 text-danger">
              (B2B2C 기능 플래그 꺼짐 — 신규 판매는 비활성)
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="결제완료 청구" value={`${stats.invoices.paid ?? 0}건`} />
        <Stat label="수납 총액" value={won(stats.grossPaid)} />
        <Stat label="정산 대기+보류" value={won(stats.settlementPending + stats.settlementHeld)} />
        <Stat label="지급 완료" value={won(stats.settlementPaid)} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["invoices", "settlements"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold ${
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t === "invoices" ? "청구/수납" : "정산"}
          </button>
        ))}
      </div>

      {tab === "invoices" && (
        <div className="space-y-2">
          {invoices.length === 0 && (
            <p className="text-sm text-muted">청구서가 없습니다.</p>
          )}
          {invoices.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{i.number}</p>
                  <p className="text-xs text-muted">
                    파트너 {i.partnerLabel} · 고객 {i.clientLabel}
                  </p>
                  <p className="mt-1 text-sm">
                    판매가 {won(i.sellPriceKrw)} · 기본요금 {won(i.basePriceKrw)} · 차액{" "}
                    {won(i.sellPriceKrw - i.basePriceKrw)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold">
                  {INV_STATUS[i.status] ?? i.status}
                </span>
              </div>
              {i.status === "paid" && (
                <div className="mt-2">
                  <ReprocessButton invoiceId={i.id} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === "settlements" && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            정산 예정액 = 수납액 − 기본요금 공제(예상 차액, 세금·PG수수료 미반영).
            실제 송금은 하지 않으며 상태·기록만 관리합니다.
          </p>
          {settlements.length === 0 && (
            <p className="text-sm text-muted">정산 내역이 없습니다.</p>
          )}
          {settlements.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{s.partnerLabel}</p>
                  <p className="text-xs text-muted">
                    {s.invoiceId ? "상품 청구" : s.quoteId ? "대행 견적" : "-"}
                  </p>
                  <p className="mt-1 text-sm">
                    수납 {won(s.grossKrw)} − 기본요금 {won(s.baseDeductionKrw)} →{" "}
                    <strong>예상 정산 {won(s.amountKrw)}</strong>
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold">
                  {SET_STATUS[s.status] ?? s.status}
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                {s.status !== "held" && (
                  <SettleButton id={s.id} status="held" label="보류" />
                )}
                {s.status !== "paid" && (
                  <SettleButton id={s.id} status="paid" label="지급완료 표시" />
                )}
                {s.status !== "pending" && (
                  <SettleButton id={s.id} status="pending" label="대기로" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-base font-semibold">{value}</p>
    </Card>
  );
}

function SettleButton({
  id,
  status,
  label,
}: {
  id: string;
  status: "pending" | "held" | "paid";
  label: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={() =>
        start(async () => {
          await setEarningStatusAction(id, status);
          router.refresh();
        })
      }
    >
      {label}
    </Button>
  );
}

function ReprocessButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const res = await reprocessInvoiceAction(invoiceId);
            setNote(res.error ?? res.note ?? "완료");
            router.refresh();
          })
        }
      >
        활성화 재처리
      </Button>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}
