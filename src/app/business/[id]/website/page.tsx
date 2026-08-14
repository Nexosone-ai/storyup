import { notFound } from "next/navigation";
import Link from "next/link";
import { getBusiness, getBrandProfile, getWebsite } from "@/lib/queries";
import { WebsiteGenerator } from "@/components/website/WebsiteGenerator";
import { WebsiteEditor } from "@/components/website/WebsiteEditor";

export const metadata = { title: "홈페이지" };

export default async function WebsitePage({
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
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="max-w-sm rounded-2xl border border-border bg-surface p-8 text-center">
          <h2 className="text-lg font-semibold">먼저 브랜드가 필요해요</h2>
          <p className="mt-2 text-sm text-muted">
            홈페이지는 브랜드 스토리를 바탕으로 만들어집니다.
          </p>
          <Link
            href={`/business/${id}/brand`}
            className="mt-5 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            브랜드 만들러 가기
          </Link>
        </div>
      </div>
    );
  }

  if (!website) {
    return <WebsiteGenerator businessId={id} />;
  }

  return <WebsiteEditor businessId={id} website={website} />;
}
