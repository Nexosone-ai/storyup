import { notFound } from "next/navigation";
import { getBusiness, getUser, getProfileName } from "@/lib/queries";
import { getAdvertiserReport } from "@/lib/ads/report";
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

  const [user, name, report] = await Promise.all([
    getUser(),
    getProfileName(),
    getAdvertiserReport(id),
  ]);

  return (
    <AdvertiserAdsView
      businessId={id}
      report={report}
      buyer={{ name: name ?? "", email: user?.email ?? "" }}
    />
  );
}
