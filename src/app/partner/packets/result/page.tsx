import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getPartnerCreditBalance } from "@/lib/partner";
import { syncProductOrder } from "@/lib/payments/orders";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";
export const metadata = { title: "패킷 결제 결과" };

export default async function PartnerPacketsResultPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentId?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { paymentId } = await searchParams;

  let ok = false;
  let message = "결제 정보를 확인하지 못했습니다.";
  if (paymentId) {
    const res = await syncProductOrder(paymentId);
    if (res.status === "PAID") {
      ok = true;
      message = `결제가 완료되어 패킷이 지급되었습니다. (${res.productName ?? ""})`;
    } else if (res.error) {
      message = res.error;
    } else {
      message = "결제가 완료되지 않았습니다.";
    }
  }
  const balance = await getPartnerCreditBalance(user.id);

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="p-8 text-center">
        <div className="mb-3 text-4xl">{ok ? "✅" : "⚠️"}</div>
        <h1 className="text-xl font-semibold">
          {ok ? "패킷 충전 완료" : "결제 확인"}
        </h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <p className="mt-3 text-sm">
          현재 보유 패킷{" "}
          <strong className="tabular-nums">{balance.toLocaleString()}</strong>
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            href="/partner/packets"
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
          >
            구매 내역
          </Link>
          <Link
            href="/partner"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            파트너 홈으로
          </Link>
        </div>
      </Card>
    </div>
  );
}
