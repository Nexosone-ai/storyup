"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { slugify } from "@/utils/slug";
import { BUSINESS_CATEGORIES } from "@/types/domain";
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

// ---------------- Business ----------------

export interface BusinessEditFields {
  name: string;
  category: string;
}

/** 비즈니스 기본 정보(이름·업종)를 수정한다. */
export async function updateBusinessAction(
  businessId: string,
  fields: BusinessEditFields,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const name = fields.name.trim();
  if (!name) return { error: "비즈니스 이름을 입력해주세요." };
  if (!(BUSINESS_CATEGORIES as readonly string[]).includes(fields.category))
    return { error: "업종을 선택해주세요." };

  const { error } = await supabase
    .from("businesses")
    .update({ name, category: fields.category })
    .eq("id", businessId);
  if (error) return { error: "저장에 실패했습니다." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/businesses");
  revalidatePath(`/business/${businessId}`);
  return { ok: true, message: "저장되었습니다." };
}

/** 비즈니스를 영구 삭제한다. 브랜드·홈페이지·블로그 등이 함께 삭제된다(DB cascade). */
export async function deleteBusinessAction(
  businessId: string,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 공개 사이트 경로 재검증용 슬러그 확보 (RLS로 소유권도 함께 확인됨).
  const { data: web } = await supabase
    .from("websites")
    .select("slug")
    .eq("business_id", businessId)
    .maybeSingle();

  const { error, count } = await supabase
    .from("businesses")
    .delete({ count: "exact" })
    .eq("id", businessId);
  if (error || !count) return { error: "삭제에 실패했습니다." };

  // 스토리지 이미지 정리 — 실패해도 삭제 자체는 성공으로 둔다.
  try {
    const admin = createAdminClient();
    const bucket = admin.storage.from("site-images");
    const folders = [businessId, `${businessId}/blog-covers`];
    for (const folder of folders) {
      const { data: files } = await bucket.list(folder, { limit: 1000 });
      const paths = (files ?? [])
        .filter((f) => f.id) // 하위 폴더 항목 제외
        .map((f) => `${folder}/${f.name}`);
      if (paths.length) await bucket.remove(paths);
    }
  } catch {
    // orphan 이미지는 치명적이지 않다.
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/businesses");
  if (web?.slug) revalidatePath(`/site/${web.slug}`);
  return { ok: true, message: "비즈니스가 삭제되었습니다." };
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

export interface SlugActionState extends ActionState {
  slug?: string;
}

/**
 * 사이트 주소(슬러그)를 사용자 지정 값으로 변경한다.
 * businesses.slug와 websites.slug를 함께 바꿔 재생성 시에도 주소가 유지되게 한다.
 */
export async function updateSiteSlugAction(
  businessId: string,
  rawSlug: string,
): Promise<SlugActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const slug = slugify(rawSlug);
  if (slug.length < 3)
    return {
      error: "주소는 영문 소문자·숫자·하이픈으로 3자 이상이어야 합니다.",
    };

  // Ownership check via RLS (+ old slug for revalidation).
  const { data: biz } = await supabase
    .from("businesses")
    .select("slug")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return { error: "권한이 없습니다." };

  // Availability across both slug-unique tables.
  const [{ data: takenBiz }, { data: takenSite }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .neq("id", businessId)
      .maybeSingle(),
    supabase
      .from("websites")
      .select("id")
      .eq("slug", slug)
      .neq("business_id", businessId)
      .maybeSingle(),
  ]);
  if (takenBiz || takenSite)
    return { error: "이미 다른 사이트가 사용 중인 주소입니다." };

  const { error: bizErr } = await supabase
    .from("businesses")
    .update({ slug })
    .eq("id", businessId);
  if (bizErr)
    return {
      error:
        bizErr.code === "23505"
          ? "이미 다른 사이트가 사용 중인 주소입니다."
          : "주소 변경에 실패했습니다.",
    };

  // 웹사이트가 아직 없으면 0행 업데이트로 무해하게 지나간다.
  const { error: siteErr } = await supabase
    .from("websites")
    .update({ slug })
    .eq("business_id", businessId);
  if (siteErr) {
    // 원자성이 없으므로 실패 시 비즈니스 슬러그를 되돌린다.
    await supabase.from("businesses").update({ slug: biz.slug }).eq("id", businessId);
    return {
      error:
        siteErr.code === "23505"
          ? "이미 다른 사이트가 사용 중인 주소입니다."
          : "주소 변경에 실패했습니다.",
    };
  }

  revalidatePath(`/business/${businessId}/website`);
  revalidatePath(`/site/${biz.slug}`);
  revalidatePath(`/site/${biz.slug}/blog`);
  revalidatePath(`/site/${slug}`);
  revalidatePath(`/site/${slug}/blog`);
  return { ok: true, slug, message: "사이트 주소가 변경되었습니다." };
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

/** Sets (or clears) a blog post's cover image URL. */
export async function updateBlogCoverAction(
  businessId: string,
  postId: string,
  url: string | null,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: post } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("id", postId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!post) return { error: "글을 찾을 수 없습니다." };

  const { error } = await supabase
    .from("blog_posts")
    .update({ cover_image_url: url })
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error) return { error: "저장에 실패했습니다." };

  const { data: web } = await supabase
    .from("websites")
    .select("slug")
    .eq("business_id", businessId)
    .maybeSingle();

  revalidatePath(`/business/${businessId}/blog/${postId}`);
  if (web?.slug) {
    revalidatePath(`/site/${web.slug}/blog`);
    revalidatePath(`/site/${web.slug}/blog/${post.slug}`);
  }
  return { ok: true, message: url ? "커버 이미지가 저장되었습니다." : "기본 커버로 변경되었습니다." };
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
