import { redirect } from "next/navigation";
import { getUser, getPrimaryBusiness } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/server";
import { listInventory, listBloggerPlacements } from "@/lib/ads/placements";
import { getBloggerEarningsReport } from "@/lib/ads/report";
import { BloggerAdsView } from "@/components/ads/BloggerAdsView";
import { AdsComingSoon } from "@/components/ads/AdsComingSoon";
import { ADS_ENABLED } from "@/lib/ads/config";
import { CHANNEL_ADS_ENABLED } from "@/lib/channelAds/config";
import { ChannelAdsHub } from "@/components/ads/ChannelAdsHub";
import { listMyChannels } from "@/lib/channelAds/channels";

export const metadata = { title: "광고 수익" };

export default async function BloggerAdsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  // 채널 공유 마켓플레이스(신규 모델) 우선. 기존 CPC(ADS_ENABLED)는 폴백.
  if (CHANNEL_ADS_ENABLED) {
    const channels = await listMyChannels(user.id);
    return (
      <ChannelAdsHub
        myChannels={channels.map((c) => ({
          id: c.id,
          platform: c.platform,
          handle: c.handle,
          url: c.url,
          followerCount: c.follower_count,
          priceKrw: c.price_krw,
          description: c.description,
          status: c.status,
        }))}
      />
    );
  }
  if (!ADS_ENABLED) return <AdsComingSoon />;

  const [primary, inventory, placements, earnings] = await Promise.all([
    getPrimaryBusiness(),
    listInventory(user.id),
    listBloggerPlacements(user.id),
    getBloggerEarningsReport(user.id),
  ]);

  // 발행된 StoryUp 사이트 보유 여부 — 광고 집행 조건.
  let canRun = false;
  if (primary?.id) {
    const { data: site } = await createAdminClient()
      .from("websites")
      .select("status")
      .eq("business_id", primary.id)
      .maybeSingle();
    canRun = site?.status === "published";
  }

  return (
    <BloggerAdsView
      bloggerBusinessId={primary?.id ?? null}
      businessName={primary?.name ?? null}
      canRun={canRun}
      inventory={inventory}
      placements={placements}
      earnings={earnings}
    />
  );
}
