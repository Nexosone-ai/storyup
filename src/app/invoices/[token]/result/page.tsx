import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { syncProductOrder } from "@/lib/payments/orders";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "결제 결과",
  robots: { index: false, follow: false },
};

/** 결제창 종료 후 복귀 — 서버가 PortOne API로 최종 재검증(멱등)하고 이행한다. */
export default async function InvoiceResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paymentId?: string }>;
}) {
  if (!B2B2C_ENABLED) notFound();
  const { token } = await params;
  const { paymentId } = await searchParams;

  let status = "FAILED";
  let error: string | undefined;
  if (paymentId && paymentId.startsWith("ord_")) {
    const res = await syncProductOrder(paymentId);
    status = res.status;
    error = res.error;
  } else {
    error = "결제 정보를 찾을 수 없습니다.";
  }
  const ok = status === "PAID";

  return (
    <main className="mx-auto w-full max-w-md px-5 py-16">
      <Card className="space-y-4 p-8 text-center">
        <p
          className={`text-lg font-semibold ${ok ? "text-success" : "text-danger"}`}
        >
          {ok ? "결제가 완료되었습니다." : "결제가 완료되지 않았습니다."}
        </p>
        {!ok && error && <p className="text-sm text-muted">{error}</p>}
        <Link
          href={`/invoices/${token}`}
          className="inline-block rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary/50"
        >
          청구서로 돌아가기
        </Link>
      </Card>
    </main>
  );
}
