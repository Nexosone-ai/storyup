import Link from "next/link";
import type { Metadata } from "next";
import { syncProductOrder } from "@/lib/payments/orders";

export const metadata: Metadata = { title: "결제 결과" };

// 결과는 항상 요청 시점에 PortOne API로 재검증한다.
export const dynamic = "force-dynamic";

export default async function PayResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    paymentId?: string;
    code?: string;
    message?: string;
    ref?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const retryHref = `/pay/${slug}${sp.ref ? `?ref=${encodeURIComponent(sp.ref)}` : ""}`;

  // PortOne 리다이렉트 실패 시 code/message가 실린다.
  let ok = false;
  let title = "결제 결과를 확인할 수 없습니다";
  let detail =
    sp.message ?? "결제 정보를 찾지 못했습니다. 다시 시도해주세요.";
  let amount: number | undefined;
  let productName: string | undefined;

  if (sp.code) {
    title = "결제가 완료되지 않았습니다";
    detail = sp.message ?? "결제가 취소되었거나 실패했습니다.";
  } else if (sp.paymentId) {
    const res = await syncProductOrder(sp.paymentId);
    productName = res.productName;
    amount = res.amount;
    if (res.status === "PAID") {
      ok = true;
      title = "결제가 완료되었습니다";
      detail = "결제해 주셔서 감사합니다. 영수증은 이메일로 발송됩니다.";
    } else if (res.error) {
      title = "결제가 완료되지 않았습니다";
      detail = res.error;
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <div
          className={`mx-auto grid size-14 place-items-center rounded-full text-2xl ${
            ok ? "bg-primary-soft text-primary" : "bg-danger/10 text-danger"
          }`}
        >
          {ok ? "✓" : "!"}
        </div>
        <h1 className="mt-4 text-lg font-bold tracking-tight">{title}</h1>
        {productName && (
          <p className="mt-3 text-sm font-medium">{productName}</p>
        )}
        {typeof amount === "number" && (
          <p className="tnum mt-1 text-2xl font-bold">
            ₩{amount.toLocaleString()}
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-muted">{detail}</p>

        {!ok && (
          <Link
            href={retryHref}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium transition hover:bg-surface-muted"
          >
            다시 시도하기
          </Link>
        )}
      </div>
    </main>
  );
}
