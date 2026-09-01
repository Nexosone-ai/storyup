import { notFound } from "next/navigation";
import { getBusiness, getBrandProfile, getWebsite } from "@/lib/queries";
import { BrandGenerator } from "@/components/ai/BrandGenerator";
import { BrandStoryView } from "@/components/ai/BrandStoryView";
import { WorkflowSteps } from "@/components/dashboard/WorkflowSteps";

export const metadata = { title: "브랜드 스토리" };

export default async function BrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  const [brand, website] = await Promise.all([
    getBrandProfile(id),
    getWebsite(id),
  ]);

  return (
    <div className="space-y-6">
      <WorkflowSteps businessId={id} current={1} />
      {brand ? (
        <BrandStoryView
          businessId={id}
          brand={brand}
          websiteExists={!!website}
        />
      ) : (
        <BrandGenerator businessId={id} />
      )}
    </div>
  );
}
