import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { CHANNEL_ADS_ENABLED } from "@/lib/channelAds/config";
import { syncProductOrder } from "@/lib/payments/orders";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";
export const metadata = { title: "결제 결과" };

export default async function ChannelShareResultPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentId?: string }>;
}) {
  if (!CHANNEL_ADS_ENABLED) redirect("/dashboard/ads");
  const user = await getUser();
  if (!user) redirect("/login");
  const { paymentId } = await searchParams;

  let ok = false;
  let message = "결제 정보를 확인하지 못했습니다.";
  if (paymentId) {
    const res = await syncProductOrder(paymentId);
    if (res.status === "PAID") {
      ok = true;
      message = "결제가 완료되어 채널 보유자에게 공유 의뢰가 전달되었습니다.";
    } else if (res.error) {
      message = res.error;
    } else {
      message = "결제가 완료되지 않았습니다.";
    }
  }

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="p-8 text-center">
        <div className="mb-3 text-4xl">{ok ? "✅" : "⚠️"}</div>
        <h1 className="text-xl font-semibold">
          {ok ? "공유 의뢰 완료" : "결제 확인"}
        </h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            href="/dashboard/ads"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            광고 수익으로
          </Link>
        </div>
      </Card>
    </div>
  );
}
