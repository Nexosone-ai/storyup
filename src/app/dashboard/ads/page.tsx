import { redirect } from "next/navigation";
import { getUser, getPrimaryBusiness } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/server";
import { listInventory, listBloggerPlacements } from "@/lib/ads/placements";
import { getBloggerEarningsReport } from "@/lib/ads/report";
import { BloggerAdsView } from "@/components/ads/BloggerAdsView";
import { AdsComingSoon } from "@/components/ads/AdsComingSoon";
import { ADS_ENABLED } from "@/lib/ads/config";

export const metadata = { title: "광고 수익" };

export default async function BloggerAdsPage() {
  const user = await getUser();
  if (!user) redirect("/login");
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
