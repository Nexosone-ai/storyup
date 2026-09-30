"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import type { BlogFaqItem } from "@/types/domain";

export interface FaqActionState {
  ok?: boolean;
  error?: string;
  faq?: BlogFaqItem[];
}

/** 공개 글 캐시 갱신 (공개 상태일 때만). */
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

/** AEO FAQ 생성 — Pro 이상(plan.aeo). 글 본문에서 Q&A를 뽑아 저장. */
export async function generateBlogFaqAction(
  businessId: string,
  postId: string,
): Promise<FaqActionState> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  if (!getPlanById(await getPlanId(user.id)).aeo)
    return {
      error: ko
        ? "AEO FAQ 생성은 Pro 플랜에서 사용할 수 있어요. 플랜을 업그레이드해주세요."
        : "AEO FAQ generation is available on the Pro plan.",
    };

  const { data: post } = await supabase
    .from("blog_posts")
    .select("id, title, content, category")
    .eq("id", postId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!post) return { error: ko ? "글을 찾을 수 없습니다." : "Post not found." };
  if (!post.content || post.content.trim().length < 100)
    return {
      error: ko
        ? "FAQ를 만들 본문이 부족해요. 글을 먼저 작성해주세요."
        : "Not enough content to build FAQ.",
    };

  let faq: BlogFaqItem[];
  try {
    const res = await getAIProvider().generateBlogFaq({
      title: post.title,
      content: post.content,
      category: post.category ?? "",
      language: ko ? "ko" : "en",
    });
    faq = (res.faq ?? [])
      .filter((f) => f && f.q && f.a)
      .slice(0, 6)
      .map((f) => ({ q: String(f.q).trim(), a: String(f.a).trim() }));
  } catch (err) {
    return {
      error:
        err instanceof AIGenerationError
          ? err.message
          : ko
            ? "FAQ 생성 중 문제가 발생했습니다."
            : "Failed to generate FAQ.",
    };
  }

  const { error } = await supabase
    .from("blog_posts")
    .update({ faq })
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error)
    return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  await revalidatePublic(supabase, businessId, postId);
  revalidatePath(`/business/${businessId}/blog/${postId}`);
  return { ok: true, faq };
}

/** FAQ 전체 삭제. */
export async function clearBlogFaqAction(
  businessId: string,
  postId: string,
): Promise<FaqActionState> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { error } = await supabase
    .from("blog_posts")
    .update({ faq: [] })
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error)
    return { error: ko ? "삭제에 실패했습니다." : "Failed to clear." };

  await revalidatePublic(supabase, businessId, postId);
  revalidatePath(`/business/${businessId}/blog/${postId}`);
  return { ok: true, faq: [] };
}
