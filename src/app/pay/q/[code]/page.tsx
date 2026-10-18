import { getQuoteByCode } from "@/lib/agency";
import { QuoteCheckoutForm } from "@/components/pay/QuoteCheckoutForm";

export const metadata = { title: "결제", robots: { index: false } };

export default async function QuotePayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const quote = await getQuoteByCode(code);

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      {!quote ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="font-semibold">결제 정보를 찾을 수 없습니다.</p>
          <p className="mt-1 text-sm text-muted">링크를 다시 확인해주세요.</p>
        </div>
      ) : quote.status === "paid" ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="font-semibold text-primary">이미 결제가 완료된 건입니다.</p>
        </div>
      ) : quote.status === "cancelled" || quote.status === "expired" ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="font-semibold">만료되었거나 취소된 결제 코드입니다.</p>
        </div>
      ) : (
        <>
          <div className="mb-5 rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm text-muted">{quote.serviceLabel}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {quote.clientPriceKrw.toLocaleString()}
              <span className="ml-1 text-lg">원</span>
            </p>
          </div>
          <QuoteCheckoutForm code={quote.code} />
        </>
      )}
    </div>
  );
}
