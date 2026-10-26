import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getUser,
  getBusiness,
  getBrandProfile,
  getWebsite,
  getSiteCards,
  getPublishedPosts,
  getManagedBlogCategories,
} from "@/lib/queries";
import { WebsiteGenerator } from "@/components/website/WebsiteGenerator";
import { WebsiteEditor } from "@/components/website/WebsiteEditor";
import { WorkflowSteps } from "@/components/dashboard/WorkflowSteps";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { isPartner } from "@/lib/partner";

export const metadata = { title: "랜딩페이지" };

export default async function WebsitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ko = (await getLocale()) === "ko";
  const business = await getBusiness(id);
  if (!business) notFound();

  const [brand, website] = await Promise.all([
    getBrandProfile(id),
    getWebsite(id),
  ]);

  let body: React.ReactNode;
  if (!brand) {
    body = (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="max-w-sm rounded-2xl border border-border bg-surface p-8 text-center">
          <h2 className="text-lg font-semibold">
            {ko ? "먼저 브랜드가 필요해요" : "You need a brand first"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {ko
              ? "랜딩페이지는 브랜드 스토리를 바탕으로 만들어집니다."
              : "Your landing page is built from your brand story."}
          </p>
          <Link
            href={`/business/${id}/brand`}
            className="mt-5 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            {ko ? "브랜드 만들러 가기" : "Create a brand"}
          </Link>
        </div>
      </div>
    );
  } else if (!website) {
    body = <WebsiteGenerator businessId={id} />;
  } else {
    // 플랜별 사용 가능한 레이아웃 수 (Free 1 · Basic 3 · Pro 9). 직원은 소유자 플랜 상속.
    const user = await getUser();
    const plan = user ? getPlanById(await getPlanId(user.id)) : null;
    const maxLayouts = plan?.siteLayouts ?? 1;
    // 전문 레이아웃·디자인 템플릿 섹션은 파트너 전용(일반/유료고객 비노출).
    const partner = user ? await isPartner(user.id) : false;
    // 미리보기의 "카드뉴스" 섹션에 표시할 이 가게의 카드뉴스.
    const content = website.content as { hero?: { businessName?: string } };
    const [cards, posts, categories] = await Promise.all([
      getSiteCards(
        id,
        website.slug,
        content.hero?.businessName ?? business.name,
      ),
      getPublishedPosts(id),
      getManagedBlogCategories(id),
    ]);
    // 글 목록(postList) 섹션 미리보기·카테고리 힌트용.
    const sectionPosts = posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      coverImageUrl: p.cover_image_url,
      publishedAt: p.published_at,
      keyword: p.keywords[0],
      category: p.category,
    }));
    body = (
      <WebsiteEditor
        businessId={id}
        website={website}
        maxLayouts={maxLayouts}
        richAllowed={plan?.fullHomepage === true}
        isPartner={partner}
        cards={cards}
        posts={sectionPosts}
        categories={categories}
      />
    );
  }

  return (
    <div className="space-y-6">
      <WorkflowSteps businessId={id} current={2} />
      {body}
    </div>
  );
}
