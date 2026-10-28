import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { IndustriesGrid } from "@/components/marketing/IndustriesGrid";
import { getLocale } from "@/lib/i18n";
import { listPublishedIndustries } from "@/lib/industries";
import { buildSeo } from "@/utils/seo";

export const metadata = buildSeo({
  title: "업종별 활용",
  description:
    "내 업종에 맞는 스토리업을 만나보세요. 외식업·카페·뷰티·병원·교육·IT·제조·부동산 등 업종별로 실제 사업 이야기를 콘텐츠로 만드는 방법을 안내합니다.",
  keywords: ["업종별", "소상공인 마케팅", "AI 콘텐츠", "스토리업"],
  path: "/industries",
});

export default async function IndustriesPage() {
  const ko = (await getLocale()) === "ko";
  const industries = await listPublishedIndustries();

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex-1 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="mx-auto max-w-2xl text-center">
            <p className="eyebrow mb-3">
              {ko ? "업종별 활용" : "By industry"}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {ko
                ? "내 업종에 맞는 스토리업을 만나보세요"
                : "Meet STORYUP tailored to your industry"}
            </h1>
            <p className="mt-3 text-muted">
              {ko
                ? "업종마다 고민도, 필요한 콘텐츠도 다릅니다. 내 사업의 실제 이야기를 콘텐츠로 만드는 방법을 업종별로 보여드려요."
                : "Every industry has different needs. See how to turn your real business story into content, tailored to yours."}
            </p>
          </header>

          <div className="mt-10">
            <IndustriesGrid
              industries={industries}
              ko={ko}
              requestHref="/industries/request"
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
