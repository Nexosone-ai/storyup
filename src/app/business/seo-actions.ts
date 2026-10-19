"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import type { BlogSeoAnalysisCache } from "@/types/domain";

export interface SeoAnalysisState {
  ok?: boolean;
  error?: string;
  analysis?: BlogSeoAnalysisCache;
}

export interface ApplySeoState {
  ok?: boolean;
  error?: string;
}

/** 공개 글 캐시 갱신(공개 상태일 때만). */
async function revalidatePublic(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  postId: string,
) {
  const { data: post } = await supabase
    .from("blog_posts")
    .select("slug, status")
    .eq("id", postId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (post?.status !== "published") return;
  const { data: web } = await supabase
    .from("websites")
    .select("slug")
    .eq("business_id", businessId)
    .maybeSingle();
  if (web?.slug) revalidatePath(`/site/${web.slug}/blog/${post.slug}`);
}

/**
 * 글별 SEO 진단·보강 — 유료 플랜(plan.seoTools: Basic·Pro·Partner).
 * 글 본문으로 약점 + 개선 문구(제목·메타·결론먼저 도입·키워드·FAQ)를 AI가 제안하고,
 * 결과를 blog_posts.seo_analysis에 캐시한다(비용 관리 — 내용 바뀌기 전까진 재호출 불필요).
 */
export async function analyzeBlogSeoAction(
  businessId: string,
  postId: string,
): Promise<SeoAnalysisState> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  if (!getPlanById(await getPlanId(user.id)).seoTools)
    return {
      error: ko
        ? "글별 SEO 진단은 유료 플랜(Basic 이상)에서 사용할 수 있어요."
        : "Per-article SEO guidance is available on paid plans.",
    };

  const { data: post } = await supabase
    .from("blog_posts")
    .select("id, title, seo_title, seo_description, keywords, content, category")
    .eq("id", postId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!post) return { error: ko ? "글을 찾을 수 없습니다." : "Post not found." };
  if (!post.content || post.content.trim().length < 100)
    return {
      error: ko
        ? "진단할 본문이 부족해요. 글을 먼저 작성해주세요."
        : "Not enough content to analyze.",
    };

  let analysis: BlogSeoAnalysisCache;
  try {
    const res = await getAIProvider().generateBlogSeoAnalysis({
      title: post.title,
      seoTitle: post.seo_title,
      seoDescription: post.seo_description,
      keywords: post.keywords ?? [],
      content: post.content,
      category: post.category ?? "",
      language: ko ? "ko" : "en",
    });
    analysis = {
      weaknesses: (res.weaknesses ?? [])
        .filter((w) => typeof w === "string" && w.trim())
        .map((w) => w.trim())
        .slice(0, 8),
      seoTitle: res.seoTitle?.trim() || undefined,
      seoDescription: res.seoDescription?.trim() || undefined,
      firstParagraph: res.firstParagraph?.trim() || undefined,
      keywords: (res.keywords ?? [])
        .filter((k) => typeof k === "string" && k.trim())
        .map((k) => k.trim())
        .slice(0, 10),
      faqIdeas: (res.faqIdeas ?? [])
        .filter((f) => f && f.q && f.a)
        .map((f) => ({ q: String(f.q).trim(), a: String(f.a).trim() }))
        .slice(0, 5),
      analyzedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      error:
        err instanceof AIGenerationError
          ? err.message
          : ko
            ? "SEO 진단 중 문제가 발생했습니다."
            : "Failed to analyze.",
    };
  }

  const { error } = await supabase
    .from("blog_posts")
    .update({ seo_analysis: analysis, seo_analyzed_at: analysis.analyzedAt })
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  revalidatePath(`/business/${businessId}/blog/${postId}`);
  return { ok: true, analysis };
}

/** AI 제안(제목·메타·키워드) 적용 — 선택한 항목만 blog_posts에 반영. */
export async function applyBlogSeoAction(
  businessId: string,
  postId: string,
  fields: { seoTitle?: string; seoDescription?: string; keywords?: string[] },
): Promise<ApplySeoState> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  if (!getPlanById(await getPlanId(user.id)).seoTools)
    return { error: ko ? "유료 플랜에서 사용할 수 있어요." : "Paid plans only." };

  const patch: {
    seo_title?: string;
    seo_description?: string;
    keywords?: string[];
  } = {};
  if (typeof fields.seoTitle === "string" && fields.seoTitle.trim())
    patch.seo_title = fields.seoTitle.trim().slice(0, 120);
  if (typeof fields.seoDescription === "string" && fields.seoDescription.trim())
    patch.seo_description = fields.seoDescription.trim().slice(0, 300);
  if (Array.isArray(fields.keywords) && fields.keywords.length)
    patch.keywords = fields.keywords
      .map((k) => String(k).trim())
      .filter(Boolean)
      .slice(0, 12);
  if (Object.keys(patch).length === 0)
    return { error: ko ? "적용할 항목이 없습니다." : "Nothing to apply." };

  const { error } = await supabase
    .from("blog_posts")
    .update(patch)
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  await revalidatePublic(supabase, businessId, postId);
  revalidatePath(`/business/${businessId}/blog/${postId}`);
  return { ok: true };
}
