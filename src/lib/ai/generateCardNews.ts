import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { CardNewsResult } from "@/types/domain";
import type { PromptLanguage } from "@/lib/ai/prompts/brand-story";
import { getAIProvider } from "@/lib/ai";
import { chargeAiUsage } from "@/lib/ai/billing";
import { trackGrowthActivity } from "@/lib/gamification/engine";
import { slugify } from "@/utils/slug";

/**
 * 기존 블로그 글로 카드뉴스 생성+저장 공통 함수 — 과금(CARD_NEWS)→생성→
 * marketing_contents(instagram_cards) upsert→성장보상→실패 시 환불.
 * `/api/ai/card-news` 라우트와 AI 에이전트 도구가 공유한다.
 */
export async function generateAndSaveCardNews(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  businessId: string;
  blogPostId: string;
  locale?: PromptLanguage;
}): Promise<{ cardNewsId: string | null; cardNews: CardNewsResult }> {
  const { supabase, userId, businessId, blogPostId } = args;

  const { data: business } = await supabase
    .from("businesses")
    .select("name,tone,slug")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) throw new Error("business not found");

  const { data: post } = await supabase
    .from("blog_posts")
    .select("title,summary,content")
    .eq("id", blogPostId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!post) throw new Error("blog post not found");

  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("tone")
    .eq("business_id", businessId)
    .maybeSingle();

  const billing = await chargeAiUsage(userId, "CARD_NEWS", "카드뉴스 생성");
  try {
    const result = await getAIProvider().generateCardNews({
      businessName: business.name,
      brandTone: brand?.tone ?? business.tone ?? "Friendly",
      handle: `@${slugify(business.slug) || "storyup"}`,
      articleTitle: post.title,
      articleSummary: post.summary ?? "",
      articleContent: post.content ?? "",
      language: args.locale ?? "ko",
    });

    await supabase
      .from("marketing_contents")
      .delete()
      .eq("business_id", businessId)
      .eq("blog_post_id", blogPostId)
      .eq("platform", "instagram_cards");

    const { data: inserted } = await supabase
      .from("marketing_contents")
      .insert({
        business_id: businessId,
        blog_post_id: blogPostId,
        platform: "instagram_cards",
        content: JSON.stringify(result),
      })
      .select("id")
      .single();

    await trackGrowthActivity(userId, "card_created", blogPostId);
    return { cardNewsId: inserted?.id ?? null, cardNews: result };
  } catch (err) {
    await billing.refund();
    throw err;
  }
}
