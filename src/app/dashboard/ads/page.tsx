import { redirect } from "next/navigation";
import { getUser, getPrimaryBusiness, getProfileName } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/server";
import { listInventory, listBloggerPlacements } from "@/lib/ads/placements";
import { getBloggerEarningsReport } from "@/lib/ads/report";
import { BloggerAdsView } from "@/components/ads/BloggerAdsView";
import { AdsComingSoon } from "@/components/ads/AdsComingSoon";
import { ADS_ENABLED } from "@/lib/ads/config";
import { CHANNEL_ADS_ENABLED } from "@/lib/channelAds/config";
import { ChannelAdsHub } from "@/components/ads/ChannelAdsHub";
import { listMyChannels, getChannelDirectory } from "@/lib/channelAds/channels";
import { listMyShareableContent } from "@/lib/channelAds/content";
import { listOwnerJobs, listMyShareRequests } from "@/lib/channelAds/jobs";
import { listOwnerEarnings } from "@/lib/channelAds/settlement";

export const metadata = { title: "광고 수익" };

export default async function BloggerAdsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  // 채널 공유 마켓플레이스(신규 모델) 우선. 기존 CPC(ADS_ENABLED)는 폴백.
  if (CHANNEL_ADS_ENABLED) {
    const [channels, directory, myContent, ownerJobs, myRequests, earnings, name] =
      await Promise.all([
        listMyChannels(user.id),
        getChannelDirectory(),
        listMyShareableContent(user.id),
        listOwnerJobs(user.id),
        listMyShareRequests(user.id),
        listOwnerEarnings(user.id),
        getProfileName(),
      ]);
    // 본인 채널은 디렉토리에서 제외(자기 채널에는 의뢰 불가).
    const directoryView = directory.filter((d) => d.ownerUserId !== user.id);
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
        directory={directoryView.map((d) => ({
          id: d.id,
          platform: d.platform,
          handle: d.handle,
          followerCount: d.followerCount,
          priceKrw: d.priceKrw,
          description: d.description,
        }))}
        myContent={myContent.map((c) => ({
          contentType: c.contentType,
          refId: c.refId,
          title: c.title,
          businessName: c.businessName,
        }))}
        ownerJobs={ownerJobs.map((j) => ({
          id: j.id,
          platform: j.platform,
          priceKrw: j.priceKrw,
          contentType: j.contentType,
          contentUrl: j.contentUrl,
          contentTitle: j.contentTitle,
          message: j.message,
          status: j.status,
          proofUrl: j.proofUrl,
          createdAt: j.createdAt,
        }))}
        myRequests={myRequests.map((j) => ({
          id: j.id,
          platform: j.platform,
          priceKrw: j.priceKrw,
          contentType: j.contentType,
          contentUrl: j.contentUrl,
          contentTitle: j.contentTitle,
          message: j.message,
          status: j.status,
          proofUrl: j.proofUrl,
          createdAt: j.createdAt,
        }))}
        earnings={{
          rows: earnings.rows,
          paidKrw: earnings.paidKrw,
          pendingKrw: earnings.pendingKrw,
          heldKrw: earnings.heldKrw,
        }}
        buyerName={name ?? ""}
        buyerEmail={user.email ?? ""}
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
