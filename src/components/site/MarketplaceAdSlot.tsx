import { getActiveAdFor } from "@/lib/ads/serve";
import type { AdSlot } from "@/lib/ads/placements";
import { ADS_ENABLED } from "@/lib/ads/config";
import { BannerView } from "@/components/website/templates/BannerView";
import { AdImpressionBeacon } from "./AdImpressionBeacon";
import type { SiteBanner } from "@/types/domain";

/**
 * 마켓플레이스 광고 슬롯(블로거 사이트) — 수락된 활성 광고 1개를 배너로 노출.
 * 클릭은 /api/ads/click/{placementId}(CPC 과금 후 광고주 URL로 302). 없으면 아무것도 렌더 안 함.
 */
export async function MarketplaceAdSlot({
  businessId,
  slot,
  className,
}: {
  businessId: string;
  slot: AdSlot;
  className?: string;
}) {
  if (!ADS_ENABLED) return null; // 광고 준비중 — 노출 안 함
  const ad = await getActiveAdFor(businessId, slot);
  if (!ad) return null;

  // CPA는 리드폼 페이지로, 그 외(CPC/CPV)는 클릭 라우트로.
  const href =
    ad.type === "cpa"
      ? `/ads/lead/${ad.placementId}`
      : `/api/ads/click/${ad.placementId}`;
  const banner: SiteBanner = {
    id: ad.placementId,
    placement: "landing",
    image: ad.creative.image,
    title: ad.creative.title,
    subtitle: ad.creative.subtitle,
    ctaLabel: ad.creative.ctaLabel,
    aspect: ad.creative.aspect ?? "3:1",
    ctaHref: href,
  };

  return (
    <div className={className}>
      <AdImpressionBeacon placementId={ad.placementId} />
      <BannerView banner={banner} />
      <p className="mt-1 text-right text-[10px] text-muted">광고</p>
    </div>
  );
}
