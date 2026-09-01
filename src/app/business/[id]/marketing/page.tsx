import { notFound } from "next/navigation";
import { getBusiness, getBlogPosts, getWebsite } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { MarketingHub } from "@/components/marketing/MarketingHub";
import { CardNewsStudio } from "@/components/cards/CardNewsStudio";
import { WorkflowSteps } from "@/components/dashboard/WorkflowSteps";
import type { CardNewsResult } from "@/types/domain";

export const metadata = { title: "SNS" };

export default async function MarketingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  const [posts, website] = await Promise.all([getBlogPosts(id), getWebsite(id)]);
  const supabase = await createClient();

  // Latest Instagram/Facebook text posts.
  const { data: textRows } = await supabase
    .from("marketing_contents")
    .select("blog_post_id,platform,content,created_at")
    .eq("business_id", id)
    .in("platform", ["instagram", "facebook"])
    .order("created_at", { ascending: false })
    .limit(2);

  const initialText: {
    instagram?: string;
    facebook?: string;
    blogPostId?: string;
  } = {};
  (textRows ?? []).forEach((row) => {
    if (row.platform === "instagram") initialText.instagram = row.content;
    if (row.platform === "facebook") initialText.facebook = row.content;
    initialText.blogPostId = row.blog_post_id ?? undefined;
  });

  // Latest card-news set.
  const { data: cardRow } = await supabase
    .from("marketing_contents")
    .select("blog_post_id,content")
    .eq("business_id", id)
    .eq("platform", "instagram_cards")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let initialCards:
    | { cardNews?: CardNewsResult; blogPostId?: string }
    | undefined;
  if (cardRow?.content) {
    try {
      initialCards = {
        cardNews: JSON.parse(cardRow.content) as CardNewsResult,
        blogPostId: cardRow.blog_post_id ?? undefined,
      };
    } catch {
      initialCards = undefined;
    }
  }

  const postOptions = posts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    published: p.status === "published",
  }));
  const siteSlug = website?.status === "published" ? website.slug : null;

  return (
    <div className="space-y-12">
      <div>
        <p className="eyebrow mb-2">SNS</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          SNS 콘텐츠 스튜디오
        </h1>
        <p className="mt-1.5 text-muted">
          블로그 글을 SNS 게시물과 카드뉴스 이미지로 바꿔보세요.
        </p>
      </div>

      <WorkflowSteps businessId={id} current={4} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">SNS 게시물</h2>
        <MarketingHub
          businessId={id}
          posts={postOptions}
          initial={initialText}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            카드뉴스 이미지
          </h2>
          <p className="mt-1 text-sm text-muted">
            인스타그램 캐러셀로 저장하고, X·Facebook에는 링크로 바로
            공유하세요.
          </p>
        </div>
        <CardNewsStudio
          businessId={id}
          posts={postOptions}
          brandName={business.name}
          handle={`@${business.slug}`}
          siteSlug={siteSlug}
          initial={initialCards}
        />
      </section>
    </div>
  );
}
