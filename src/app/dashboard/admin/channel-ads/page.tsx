import { notFound } from "next/navigation";
import { CHANNEL_ADS_ENABLED } from "@/lib/channelAds/config";
import { listChannelsAdmin } from "@/lib/channelAds/channels";
import { AdminChannelAdsView } from "@/components/admin/AdminChannelAdsView";

export const metadata = { title: "관리자 · 채널 광고" };

export default async function AdminChannelAdsPage() {
  if (!CHANNEL_ADS_ENABLED) notFound();
  // /dashboard/admin/layout.tsx 에서 이미 관리자 가드됨.
  const channels = await listChannelsAdmin();

  return (
    <div className="mx-auto max-w-3xl">
      <AdminChannelAdsView
        channels={channels.map((c) => ({
          id: c.id,
          ownerLabel: c.ownerLabel,
          platform: c.platform,
          handle: c.handle,
          url: c.url,
          followerCount: c.followerCount,
          priceKrw: c.priceKrw,
          description: c.description,
          status: c.status,
          createdAt: c.createdAt,
        }))}
      />
    </div>
  );
}
