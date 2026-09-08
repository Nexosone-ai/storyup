import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { BlogArticleResult } from "@/types/domain";
import { slugWithFallback, randomSuffix } from "@/utils/slug";
import { trackGrowthActivity } from "@/lib/gamification/engine";
import { generateAndStoreBlogCover } from "@/lib/ai/blogCover";

/**
 * AI가 생성한 글을 blog_posts draft로 저장하는 공통 시퀀스.
 * (slug 중복 회피 → insert → 성장 보상 → 커버 이미지) — /api/ai/blog 와
 * /api/ai/blog-voice 가 함께 사용한다. insert 실패 시 throw (호출부가 환불 처리).
 */
export async function createBlogDraft(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  businessId: string;
  category: string;
  article: BlogArticleResult;
}): Promise<string> {
  const { supabase, userId, businessId, category, article } = args;

  // Unique slug within this business.
  let slug = slugWithFallback(article.title, "post");
  const { data: dup } = await supabase
    .from("blog_posts")
    .select("id")
    .eq("business_id", businessId)
    .eq("slug", slug)
    .maybeSingle();
  if (dup) slug = `${slug}-${randomSuffix()}`;

  const { data: inserted, error } = await supabase
    .from("blog_posts")
    .insert({
      business_id: businessId,
      title: article.title,
      slug,
      summary: article.summary,
      content: article.content,
      keywords: article.keywords ?? [],
      seo_title: article.seo_title,
      seo_description: article.seo_description,
      social_caption: article.social_caption,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !inserted) throw error ?? new Error("insert failed");

  // 성장 보상 — 실패해도 생성 흐름을 막지 않는다 (멱등키: 글 ID)
  await trackGrowthActivity(userId, "blog_created", inserted.id);

  // 커버 이미지는 실패하거나 늦어도 글 생성을 막지 않는다 (플레이스홀더로 대체).
  const cover = await generateAndStoreBlogCover({
    businessId,
    category,
    title: article.title,
    keywords: article.keywords ?? [],
    imageSubject: article.image_subject,
    timeoutMs: 25_000,
  });
  if (cover) {
    await supabase
      .from("blog_posts")
      .update({ cover_image_url: cover })
      .eq("id", inserted.id);
  }

  return inserted.id;
}
