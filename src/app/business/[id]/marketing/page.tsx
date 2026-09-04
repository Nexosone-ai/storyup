import { notFound } from "next/navigation";
import { getBusiness, getBlogPosts, getWebsite } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { MarketingHub } from "@/components/marketing/MarketingHub";
import { CardNewsStudio } from "@/components/cards/CardNewsStudio";
import { WorkflowSteps } from "@/components/dashboard/WorkflowSteps";
import { GuidedTour } from "@/components/ui/GuidedTour";
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

      <GuidedTour
        storageKey="tour.sns.v1"
        autoStart={
          !initialText.instagram && !initialText.facebook && !initialCards
        }
        steps={[
          {
            target: "[data-tour=sns-posts]",
            title: ko
              ? "① 블로그 글을 SNS 글로 바꿔요"
              : "① Turn a blog post into a caption",
            desc: ko
              ? "블로그 글을 고르고 'SNS 콘텐츠 생성'을 누르면 인스타그램·페이스북에 붙여넣을 글(캡션)이 만들어져요. 자동으로 게시되지는 않아요 — 복사해서 앱에서 올려요."
              : "Pick a blog post and press Generate to get captions for Instagram and Facebook. Nothing posts automatically — copy and paste in the app.",
          },
          {
            target: "[data-tour=card-news]",
            title: ko
              ? "② 같은 글로 카드뉴스 이미지를 만들어요"
              : "② Make card news images from the same post",
            desc: ko
              ? "'카드뉴스 생성'을 누르면 인스타그램에 여러 장으로 올리는 카드 이미지가 만들어져요. 위에서 만든 캡션과 짝지어 올리면 완성!"
              : "Press Generate to create swipeable Instagram cards. Pair them with the caption above and you're done!",
          },
          {
            target: "[data-tour=card-actions]",
            title: ko
              ? "③ 카드 배경은 꼭 채워주세요!"
              : "③ Don't forget card backgrounds!",
            desc: ko
              ? "카드를 만든 뒤 'AI 이미지 생성'을 누르거나, 카드마다 '사진 올리기'로 내 사진을 넣어주세요. 배경 없이 저장하면 글자만 있는 밋밋한 카드가 돼요."
              : "After generating cards, press 'Generate AI images' or upload your own photo per card. Cards saved without a background look plain.",
          },
        ]}
      />

      <section data-tour="sns-posts" className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          {ko ? "SNS 게시물" : "Social posts"}
        </h2>
        <MarketingHub
          businessId={id}
          posts={postOptions}
          initial={initialText}
        />
      </section>

      <section id="card-news" data-tour="card-news" className="scroll-mt-24 space-y-4">
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
