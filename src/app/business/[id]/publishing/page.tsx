import { notFound } from "next/navigation";
import { getBusiness } from "@/lib/queries";
import { getPublishingData } from "@/lib/publishing";
import { PublishingHub } from "@/components/publishing/PublishingHub";

export const metadata = { title: "발행" };

export default async function PublishingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  const data = await getPublishingData(id);
  return <PublishingHub businessId={id} data={data} />;
}
