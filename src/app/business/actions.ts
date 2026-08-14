"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { WebsiteContent } from "@/types/domain";

export interface ActionState {
  error?: string;
  message?: string;
  ok?: boolean;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------- Brand ----------------

export interface BrandEditFields {
  brand_name: string;
  headline: string;
  slogan: string;
  short_description: string;
  brand_story: string;
  mission: string;
  key_strengths: string[];
  brand_keywords: string[];
}

export async function updateBrandAction(
  businessId: string,
  fields: BrandEditFields,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("brand_profiles")
    .update({
      brand_name: fields.brand_name,
      headline: fields.headline,
      slogan: fields.slogan,
      short_description: fields.short_description,
      brand_story: fields.brand_story,
      mission: fields.mission,
      key_strengths: fields.key_strengths,
      brand_keywords: fields.brand_keywords,
    })
    .eq("business_id", businessId);
  if (error) return { error: "저장에 실패했습니다." };

  revalidatePath(`/business/${businessId}/brand`);
  return { ok: true, message: "저장되었습니다." };
}

// ---------------- Website ----------------

export async function saveWebsiteAction(
  businessId: string,
  content: WebsiteContent,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("websites")
    .update({ content })
    .eq("business_id", businessId);
  if (error) return { error: "저장에 실패했습니다." };

  revalidatePath(`/business/${businessId}/website`);
  return { ok: true, message: "저장되었습니다." };
}

export async function publishWebsiteAction(
  businessId: string,
  publish: boolean,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: web } = await supabase
    .from("websites")
    .select("slug")
    .eq("business_id", businessId)
    .maybeSingle();

  const { error } = await supabase
    .from("websites")
    .update({
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq("business_id", businessId);
  if (error) return { error: "처리에 실패했습니다." };

  revalidatePath(`/business/${businessId}/website`);
  if (web?.slug) revalidatePath(`/site/${web.slug}`);
  return {
    ok: true,
    message: publish ? "홈페이지가 공개되었습니다." : "비공개로 전환되었습니다.",
  };
}

// ---------------- Blog ----------------

export async function saveBlogAction(
  businessId: string,
  postId: string,
  fields: { title: string; content: string; summary: string },
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("blog_posts")
    .update({
      title: fields.title,
      content: fields.content,
      summary: fields.summary,
    })
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error) return { error: "저장에 실패했습니다." };

  revalidatePath(`/business/${businessId}/blog/${postId}`);
  return { ok: true, message: "저장되었습니다." };
}

export async function publishBlogAction(
  businessId: string,
  postId: string,
  publish: boolean,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: post } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("id", postId)
    .maybeSingle();
  const { data: web } = await supabase
    .from("websites")
    .select("slug")
    .eq("business_id", businessId)
    .maybeSingle();

  const { error } = await supabase
    .from("blog_posts")
    .update({
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error) return { error: "처리에 실패했습니다." };

  revalidatePath(`/business/${businessId}/blog`);
  if (web?.slug) {
    revalidatePath(`/site/${web.slug}/blog`);
    if (post?.slug) revalidatePath(`/site/${web.slug}/blog/${post.slug}`);
  }
  return {
    ok: true,
    message: publish ? "블로그 글이 공개되었습니다." : "비공개로 전환되었습니다.",
  };
}

export async function deleteBlogAction(
  businessId: string,
  postId: string,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("blog_posts")
    .delete()
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error) return { error: "삭제에 실패했습니다." };

  revalidatePath(`/business/${businessId}/blog`);
  return { ok: true };
}
