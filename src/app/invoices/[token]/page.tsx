import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { getInvoiceByToken, toPublicInvoice } from "@/lib/b2b2c/invoices";
import { Card } from "@/components/ui/Card";
import { InvoiceCheckout } from "@/components/b2b2c/InvoiceCheckout";

// 고객별 청구서는 검색엔진에 노출하지 않는다(토큰 기반 비공개).
export const metadata: Metadata = {
  title: "청구서",
  robots: { index: false, follow: false },
};

const won = (n: number) => `₩${n.toLocaleString()}`;

const STATUS_LABEL: Record<string, string> = {
  issued: "발행됨",
  pending_payment: "결제 대기",
  paid: "결제 완료",
  void: "무효",
  refunded: "환불됨",
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!B2B2C_ENABLED) notFound();
  const { token } = await params;
  const row = await getInvoiceByToken(token);
  if (!row) notFound();
  const inv = toPublicInvoice(row);

  const total =
    inv.vatMode === "excluded" ? inv.sellPriceKrw + inv.taxKrw : inv.sellPriceKrw;
  const paid = inv.status === "paid";
  const payable = inv.status === "issued" || inv.status === "pending_payment";

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <div className="mb-5">
        <p className="eyebrow mb-1">청구서</p>
        <h1 className="text-xl font-semibold tracking-tight">{inv.name}</h1>
        <p className="mt-1 text-xs text-muted">No. {inv.number}</p>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">상태</span>
          <span
            className={`text-sm font-semibold ${paid ? "text-success" : "text-foreground"}`}
          >
            {STATUS_LABEL[inv.status] ?? inv.status}
          </span>
        </div>

        {inv.includedServices && (
          <div className="rounded-lg bg-surface-2 p-3 text-sm whitespace-pre-line">
            {inv.includedServices}
          </div>
        )}

        <div className="space-y-1.5 border-t border-border pt-4 text-sm">
          <Row label="판매가" value={won(inv.sellPriceKrw)} />
          {inv.vatMode === "excluded" && (
            <Row label="부가세" value={won(inv.taxKrw)} />
          )}
          <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
            <span>결제 금액</span>
            <span>{won(total)}</span>
          </div>
          <p className="pt-1 text-xs text-muted">
            {inv.vatMode === "included" ? "부가세 포함" : "부가세 별도"}
            {inv.billingType === "recurring"
              ? ` · ${inv.billingPeriod === "monthly" ? "월" : "정기"} 청구`
              : " · 1회 청구"}
          </p>
        </div>

        {(inv.periodStart || inv.periodEnd) && (
          <div className="text-xs text-muted">
            이용 기간: {inv.periodStart ?? "-"} ~ {inv.periodEnd ?? "-"}
          </div>
        )}

        <div className="border-t border-border pt-4 text-xs text-muted">
          {inv.sellerName && <p>판매자: {inv.sellerName}</p>}
          {inv.sellerInfo && <p>{inv.sellerInfo}</p>}
          <p>수납: {inv.collectorInfo} (STORYUP이 결제대금을 수납합니다)</p>
        </div>
      </Card>

      {paid && (
        <Card className="mt-4 p-6 text-center">
          <p className="text-success font-semibold">결제가 완료되었습니다.</p>
          {inv.paidAt && (
            <p className="mt-1 text-xs text-muted">
              {new Date(inv.paidAt).toLocaleString("ko-KR")}
            </p>
          )}
        </Card>
      )}

      {payable && (
        <Card className="mt-4 space-y-4 p-6">
          <h2 className="text-sm font-semibold">카드/간편결제</h2>
          <InvoiceCheckout token={inv.token} />
          <div className="border-t border-border pt-3 text-xs text-muted">
            계좌 입금을 원하시면 판매자에게 문의해주세요. (입금 확인 후 활성화)
          </div>
        </Card>
      )}

      {!paid && !payable && (
        <Card className="mt-4 p-6 text-center text-sm text-muted">
          현재 결제할 수 없는 청구서입니다. 판매자에게 문의해주세요.
        </Card>
      )}

      <p className="mt-4 text-center text-xs text-muted">
        세금계산서·현금영수증은 별도 요청이 필요할 수 있습니다.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
