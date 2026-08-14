import { notFound } from "next/navigation";
import { getBusiness, getBrandProfile, getWebsite } from "@/lib/queries";
import { BrandGenerator } from "@/components/ai/BrandGenerator";
import { BrandStoryView } from "@/components/ai/BrandStoryView";

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

  if (!brand) {
    return <BrandGenerator businessId={id} />;
  }

  return (
    <BrandStoryView
      businessId={id}
      brand={brand}
      websiteExists={!!website}
    />
  );
}
