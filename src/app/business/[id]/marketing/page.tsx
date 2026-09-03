import { notFound } from "next/navigation";
import { getBusiness, getBlogPosts, getWebsite } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { MarketingHub } from "@/components/marketing/MarketingHub";
import { CardNewsStudio } from "@/components/cards/CardNewsStudio";
import { WorkflowSteps } from "@/components/dashboard/WorkflowSteps";
import { GuideCard } from "@/components/ui/GuideCard";
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
  const ko = (await getLocale()) === "ko";

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
    socialCaption: p.social_caption,
  }));
  const siteSlug = website?.status === "published" ? website.slug : null;

  return (
    <div className="space-y-12">
      <div>
        <p className="eyebrow mb-2">SNS</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "SNS 콘텐츠 스튜디오" : "Social content studio"}
        </h1>
        <p className="mt-1.5 text-muted">
          {ko
            ? "블로그 글을 SNS 게시물과 카드뉴스 이미지로 바꿔보세요."
            : "Turn blog posts into social posts and card news images."}
        </p>
      </div>

      <WorkflowSteps businessId={id} current={4} />

      <GuideCard
        storageKey="guide.sns.v1"
        title={
          ko ? "SNS 콘텐츠, 이렇게 쓰는 거예요" : "How the social studio works"
        }
        steps={[
          {
            title: ko ? "블로그 글을 고르세요" : "Pick a blog post",
            desc: ko
              ? "여기 있는 모든 콘텐츠는 내 블로그 글에서 만들어져요."
              : "Everything here is made from your blog posts.",
          },
          {
            title: ko
              ? "글(캡션)과 카드뉴스 이미지를 만들어요"
              : "Generate a caption and card news images",
            desc: ko
              ? "'SNS 게시물'은 인스타그램·페이스북에 붙여넣을 글이고, '카드뉴스'는 함께 올릴 이미지예요. 둘을 짝지어 올리면 완성!"
              : "'Social posts' is the text to paste into Instagram/Facebook, and 'card news' is the images to post with it. Pair them and you're done!",
          },
          {
            title: ko
              ? "복사·저장해서 각 앱에서 직접 올리세요"
              : "Copy or save, then post from each app",
            desc: ko
              ? "자동으로 올라가지는 않아요. 만든 콘텐츠를 복사하거나 저장한 뒤 인스타그램·페이스북 앱에서 직접 게시해요. 방법은 아래에서 단계별로 알려드려요."
              : "Nothing is uploaded automatically. Copy or save what you made, then post it yourself from the Instagram/Facebook app — step-by-step instructions are below.",
          },
        ]}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          {ko ? "SNS 게시물" : "Social posts"}
        </h2>
        <MarketingHub
          businessId={id}
          posts={postOptions}
          initial={initialText}
        />
      </section>

      <section id="card-news" className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {ko ? "카드뉴스 이미지" : "Card news images"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {ko
              ? "인스타그램 캐러셀로 저장하고, X·Facebook에는 링크로 바로 공유하세요."
              : "Save as an Instagram carousel, or share the link straight to X and Facebook."}
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
