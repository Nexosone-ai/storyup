import { notFound } from "next/navigation";
import { getLeadAd } from "@/lib/ads/leads";
import { ADS_ENABLED } from "@/lib/ads/config";
import { BannerView } from "@/components/website/templates/BannerView";
import { AdLeadForm } from "@/components/site/AdLeadForm";
import type { SiteBanner } from "@/types/domain";

export const metadata = { title: "신청" };
export const dynamic = "force-dynamic";

export default async function AdLeadPage({
  params,
}: {
  params: Promise<{ placementId: string }>;
}) {
  const { placementId } = await params;
  if (!ADS_ENABLED) notFound();
  const ad = await getLeadAd(placementId);
  if (!ad) notFound();

  const banner: SiteBanner = {
    id: placementId,
    placement: "landing",
    image: ad.creative.image,
    title: ad.creative.title,
    subtitle: ad.creative.subtitle,
    ctaLabel: ad.creative.ctaLabel,
    aspect: ad.creative.aspect ?? "3:1",
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
      <BannerView banner={banner} />
      <AdLeadForm placementId={placementId} />
      <p className="text-center text-[10px] text-muted">광고 · {ad.campaignName}</p>
    </main>
  );
}
