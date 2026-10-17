import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { BlogTone, BlogLength } from "@/types/domain";
import type { PromptLanguage } from "@/lib/ai/prompts/brand-story";
import { getAIProvider } from "@/lib/ai";
import { chargeAiUsage } from "@/lib/ai/billing";
import { createBlogDraft } from "@/lib/blogDraft";

/**
 * AI 블로그 초안 생성+저장 공통 함수 — 과금(AI_BLOG)→생성→초안 저장→실패 시 환불.
 * `/api/ai/blog` 라우트와 AI 에이전트 도구가 함께 쓴다. 과금/한도 오류
 * (InsufficientPointsError·FreeBlogLimitError)는 그대로 throw(호출부가 매핑).
 */
export async function generateAndSaveBlog(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  businessId: string;
  topic: string;
  tone?: BlogTone;
  length?: BlogLength;
  locale?: PromptLanguage;
}): Promise<{ postId: string; title: string }> {
  const { supabase, userId, businessId, topic } = args;

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) throw new Error("business not found");

  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("tone")
    .eq("business_id", businessId)
    .maybeSingle();

  const billing = await chargeAiUsage(userId, "AI_BLOG", "AI 블로그 생성");
  try {
    const article = await getAIProvider().generateBlog({
      businessName: business.name,
      category: business.category,
      brandTone: brand?.tone ?? business.tone ?? "Friendly",
      topic,
      tone: args.tone ?? "Friendly",
      length: args.length ?? "Medium",
      language: args.locale ?? "ko",
    });
    const postId = await createBlogDraft({
      supabase,
      userId,
      businessId,
      category: business.category,
      article,
    });
    return { postId, title: article.title };
  } catch (err) {
    await billing.refund();
    throw err;
  }
}
