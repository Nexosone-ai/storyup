import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { getPartnerCreditBalance } from "@/lib/partner";
import { listMyPacketOrders, PACKET_BANK } from "@/lib/partner/packets";
import { createAdminClient } from "@/lib/supabase/server";
import { PacketStore } from "@/components/partner/PacketStore";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "패킷 구매",
  robots: { index: false, follow: false },
};

export default async function PartnerPacketsPage() {
  const ko = (await getLocale()) === "ko";
  const user = await getUser();
  if (!user) return null; // layout에서 이미 가드

  const admin = createAdminClient();
  const [balance, orders, profile] = await Promise.all([
    getPartnerCreditBalance(user.id),
    listMyPacketOrders(user.id),
    admin
      .from("profiles")
      .select("name, email")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const cardEnabled =
    !!process.env.NEXT_PUBLIC_PORTONE_STORE_ID &&
    !!process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY &&
    !!process.env.PORTONE_API_SECRET;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">{ko ? "파트너 대행" : "Partner"}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {ko ? "패킷 구매" : "Buy packets"}
          </h1>
          <p className="mt-1.5 text-muted">
            {ko
              ? "패킷(크레딧)은 블로그·쇼츠·영상 등 파트너 작업에 차감됩니다. 카드결제는 즉시, 계좌이체는 입금 확인 후 지급됩니다."
              : "Packets (credits) are consumed by partner tasks. Card payments are granted instantly; bank transfers after confirmation."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border bg-surface px-4 py-2 text-right">
            <p className="text-[11px] text-muted">
              {ko ? "보유 패킷" : "Balance"}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {balance.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <PacketStore
        balance={balance}
        orders={orders}
        buyer={{
          name: profile.data?.name ?? "",
          email: profile.data?.email ?? user.email ?? "",
        }}
        bank={PACKET_BANK}
        cardEnabled={cardEnabled}
      />
    </div>
  );
}
