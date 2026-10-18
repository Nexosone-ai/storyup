import Link from "next/link";
import { syncProductOrder } from "@/lib/payments/orders";

export const metadata = { title: "결제 결과", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function QuoteResultPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentId?: string }>;
}) {
  const sp = await searchParams;
  const paymentId = sp.paymentId ?? "";
  const res = paymentId.startsWith("ord_")
    ? await syncProductOrder(paymentId)
    : { status: "FAILED", error: "주문 정보가 올바르지 않습니다." };

  const paid = res.status === "PAID";
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="rounded-2xl border border-border bg-surface p-8">
        <p className={`text-xl font-semibold ${paid ? "text-primary" : "text-foreground"}`}>
          {paid ? "결제가 완료되었습니다 🎉" : "결제가 완료되지 않았습니다"}
        </p>
        {paid ? (
          <p className="mt-2 text-sm text-muted">
            담당 파트너가 곧 진행해드립니다. 결제 영수증은 이메일로 발송됩니다.
          </p>
        ) : (
          <p className="mt-2 text-sm text-danger">
            {res.error ?? "잠시 후 다시 시도해주세요."}
          </p>
        )}
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-xl border border-border px-4 py-2 text-sm font-medium hover:border-primary"
        >
          대시보드로
        </Link>
      </div>
    </div>
  );
}
