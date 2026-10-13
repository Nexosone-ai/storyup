import { redirect } from "next/navigation";
import { getUser, getPrimaryBusiness } from "@/lib/queries";
import { listInventory, listBloggerPlacements } from "@/lib/ads/placements";
import { getBloggerEarningsReport } from "@/lib/ads/report";
import { BloggerAdsView } from "@/components/ads/BloggerAdsView";

export const metadata = { title: "광고 수익" };

export default async function BloggerAdsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [primary, inventory, placements, earnings] = await Promise.all([
    getPrimaryBusiness(),
    listInventory(user.id),
    listBloggerPlacements(user.id),
    getBloggerEarningsReport(user.id),
  ]);

  return (
    <BloggerAdsView
      bloggerBusinessId={primary?.id ?? null}
      businessName={primary?.name ?? null}
      inventory={inventory}
      placements={placements}
      earnings={earnings}
    />
  );
}
