import { notFound } from "next/navigation";
import { getBusiness, getUser, getProfileName } from "@/lib/queries";
import { getAdvertiserReport } from "@/lib/ads/report";
import { listAdvertiserLeads } from "@/lib/ads/leads";
import { listPlacementRequests } from "@/lib/ads/placements";
import { AdvertiserAdsView } from "@/components/ads/AdvertiserAdsView";

export const metadata = { title: "광고" };

export default async function AdsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  const [user, name, report, leadRows, requests] = await Promise.all([
    getUser(),
    getProfileName(),
    getAdvertiserReport(id),
    listAdvertiserLeads(id),
    listPlacementRequests(id),
  ]);

  const campName = new Map(report.campaigns.map((c) => [c.campaignId, c.name]));
  const leads = leadRows.map((l) => ({
    id: l.id,
    campaignName: campName.get(l.campaign_id) ?? "",
    name: l.name,
    phone: l.phone,
    message: l.message,
    createdAt: l.created_at,
  }));

  return (
    <AdvertiserAdsView
      businessId={id}
      report={report}
      buyer={{ name: name ?? "", email: user?.email ?? "" }}
      leads={leads}
      requests={requests.map((r) => ({
        id: r.id,
        campaignName: r.campaignName,
        bloggerName: r.bloggerName,
        bloggerSlug: r.bloggerSlug,
        slots: r.slots,
      }))}
    />
  );
}
