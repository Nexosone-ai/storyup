"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { WebsiteContent } from "@/types/domain";

const IMAGE_BUCKET = "site-images";

export interface UploadResult {
  url?: string;
  error?: string;
}

/** Uploads a user image to Supabase Storage and returns its public URL. */
export async function uploadSiteImage(
  businessId: string,
  formData: FormData,
): Promise<UploadResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // Ownership check via RLS.
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return { error: "권한이 없습니다." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "이미지를 선택해주세요." };
  if (file.size > 10 * 1024 * 1024)
    return { error: "이미지는 10MB 이하여야 합니다." };

  const admin = createAdminClient();

  // Ensure the public bucket exists (idempotent).
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.some((b) => b.name === IMAGE_BUCKET)) {
      await admin.storage.createBucket(IMAGE_BUCKET, {
        public: true,
        fileSizeLimit: "10MB",
      });
    }
  } catch {
    // If listing/creating fails but the bucket already exists, upload still works.
  }

  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `${businessId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error } = await admin.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: "업로드에 실패했습니다." };

  const {
    data: { publicUrl },
  } = admin.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return { url: publicUrl };
}

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
