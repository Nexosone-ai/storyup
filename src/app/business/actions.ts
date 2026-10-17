"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { trackGrowthActivity } from "@/lib/gamification/engine";
import { getLocale } from "@/lib/i18n";
import { slugify, randomSuffix } from "@/utils/slug";
import { getPlanId, getShortsQuota } from "@/lib/subscription";
import {
  consumeFreeBlogIfApplicable,
  requestFreeReapply,
  FreeBlogLimitError,
} from "@/lib/freeAccess";
import {
  getRefreshToken,
  refreshAccessToken,
  disconnect as disconnectYoutube,
} from "@/lib/youtube";
import { SHORTS_ENABLED } from "@/lib/shorts/config";
import { getPlanById } from "@/lib/plans";
import { applyEventDefaultsToNewPost } from "@/lib/events";
import { BUSINESS_CATEGORIES, INDUSTRY_IDS } from "@/types/domain";
import type { WebsiteContent, IndustryId } from "@/types/domain";

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
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // Ownership check via RLS.
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz)
    return { error: ko ? "권한이 없습니다." : "You don't have permission." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: ko ? "이미지를 선택해주세요." : "Please choose an image." };
  if (file.size > 10 * 1024 * 1024)
    return {
      error: ko
        ? "이미지는 10MB 이하여야 합니다."
        : "Images must be 10MB or smaller.",
    };

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
  if (error) return { error: ko ? "업로드에 실패했습니다." : "Upload failed." };

  const {
    data: { publicUrl },
  } = admin.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return { url: publicUrl };
}

const VOICE_BUCKET = "voice-notes";

export interface VoiceUploadTicket {
  path?: string;
  token?: string;
  error?: string;
}

/**
 * 음성 녹음 업로드용 서명 URL 발급 (블로그 음성 작성).
 * 오디오는 Vercel 요청 본문 한도(4.5MB)를 넘기 쉬워 클라이언트가
 * Storage에 직접 올린다. 버킷은 비공개 — 처리 후 라우트가 파일을 지운다.
 */
export async function createVoiceUploadUrl(
  businessId: string,
  ext: string,
): Promise<VoiceUploadTicket> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // Ownership check via RLS.
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz)
    return { error: ko ? "권한이 없습니다." : "You don't have permission." };

  const safeExt = /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : "bin";
  const admin = createAdminClient();

  // Ensure the private bucket exists (idempotent).
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.some((b) => b.name === VOICE_BUCKET)) {
      await admin.storage.createBucket(VOICE_BUCKET, {
        public: false,
        fileSizeLimit: "25MB",
      });
    }
  } catch {
    // If listing/creating fails but the bucket already exists, signing still works.
  }

  const path = `${businessId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${safeExt}`;
  const { data, error } = await admin.storage
    .from(VOICE_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data)
    return {
      error: ko ? "업로드 준비에 실패했습니다." : "Failed to prepare upload.",
    };
  return { path: data.path, token: data.token };
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

/**
 * AI 없이 빈 초안을 만들어 직접 작성하도록 한다.
 * AI 호출·커버 이미지·생성 보상 없이 blog_posts draft 1행만 생성(발행 보상은 발행 시 지급).
 */
export async function createBlankBlogAction(
  businessId: string,
): Promise<{ postId?: string; error?: string }> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // 소유(또는 직원) 사업장인지 확인 — 쓰기는 RLS(owns_business)로도 강제된다.
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz)
    return { error: ko ? "사업장을 찾을 수 없습니다." : "Business not found." };

  // 무료 플랜 블로그 한도(하루 1·월 30·이용권) 검증 + 사용 기록.
  let freeBilling: { refund: () => Promise<void> } | null = null;
  try {
    freeBilling = await consumeFreeBlogIfApplicable(user.id, ko);
  } catch (e) {
    if (e instanceof FreeBlogLimitError) return { error: e.message };
    throw e;
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      business_id: businessId,
      title: ko ? "새 글" : "New post",
      slug: `post-${randomSuffix()}`,
      content: "",
      keywords: [],
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) {
    await freeBilling?.refund();
    return { error: ko ? "글 생성에 실패했습니다." : "Failed to create." };
  }

  // 사업체 이벤트 기본값(댓글·주소·지도·연락문의·예약)을 새 글에도 상속 (쿠폰 제외).
  await applyEventDefaultsToNewPost(supabase, businessId, data.id);

  revalidatePath(`/business/${businessId}/blog`);
  return { postId: data.id };
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
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const name = fields.name.trim();
  if (!name)
    return {
      error: ko ? "비즈니스 이름을 입력해주세요." : "Please enter a business name.",
    };
  if (!(BUSINESS_CATEGORIES as readonly string[]).includes(fields.category))
    return { error: ko ? "업종을 선택해주세요." : "Please select a category." };

  const { error } = await supabase
    .from("businesses")
    .update({ name, category: fields.category })
    .eq("id", businessId);
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/businesses");
  revalidatePath(`/business/${businessId}`);
  return { ok: true, message: ko ? "저장되었습니다." : "Saved." };
}

/** 비즈니스를 영구 삭제한다. 브랜드·랜딩페이지·블로그 등이 함께 삭제된다(DB cascade). */
export async function deleteBusinessAction(
  businessId: string,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

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
  if (error || !count)
    return { error: ko ? "삭제에 실패했습니다." : "Failed to delete." };

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
  return {
    ok: true,
    message: ko ? "비즈니스가 삭제되었습니다." : "Business deleted.",
  };
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
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

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
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  // 성장 보상 — 브랜드 프로필 완성 (비즈니스당 1회 멱등, 핵심 필드가 채워졌을 때만)
  if (fields.brand_story && fields.headline && fields.short_description)
    await trackGrowthActivity(user.id, "brand_profile", businessId);

  revalidatePath(`/business/${businessId}/brand`);
  return { ok: true, message: ko ? "저장되었습니다." : "Saved." };
}

// ---------------- Website ----------------

export async function saveWebsiteAction(
  businessId: string,
  content: WebsiteContent,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { error } = await supabase
    .from("websites")
    .update({ content })
    .eq("business_id", businessId);
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  // 성장 활동 — 홈페이지 업데이트 (보상은 하루 1회)
  await trackGrowthActivity(user.id, "site_updated");

  revalidatePath(`/business/${businessId}/website`);
  return { ok: true, message: ko ? "저장되었습니다." : "Saved." };
}

// ---------------- 블로그 카테고리 관리 (사장님) ----------------

/** 현재 관리 목록을 읽는다(소유자 RLS). */
async function readBlogCategories(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  businessId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("businesses")
    .select("blog_categories")
    .eq("id", businessId)
    .maybeSingle();
  return (data?.blog_categories ?? []).filter(Boolean);
}

/** 카테고리 추가 (중복·공백 제외, 최대 30자). */
export async function addBlogCategoryAction(
  businessId: string,
  name: string,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  const clean = name.trim().slice(0, 30);
  if (!clean) return { error: ko ? "카테고리명을 입력하세요." : "Enter a name." };

  const list = await readBlogCategories(supabase, businessId);
  if (list.includes(clean))
    return { error: ko ? "이미 있는 카테고리입니다." : "Already exists." };
  const { error } = await supabase
    .from("businesses")
    .update({ blog_categories: [...list, clean] })
    .eq("id", businessId);
  if (error)
    return {
      error: ko
        ? "추가에 실패했습니다. (0054 마이그레이션 확인)"
        : "Failed to add.",
    };
  revalidatePath(`/business/${businessId}/blog`);
  return { ok: true, message: ko ? "카테고리를 추가했습니다." : "Added." };
}

/** 카테고리 이름 변경 — 관리 목록 + 해당 글들의 category를 함께 변경. */
export async function renameBlogCategoryAction(
  businessId: string,
  oldName: string,
  newName: string,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  const from = oldName.trim();
  const to = newName.trim().slice(0, 30);
  if (!from || !to) return { error: ko ? "카테고리명을 입력하세요." : "Enter a name." };
  if (from === to) return { ok: true };

  const list = await readBlogCategories(supabase, businessId);
  const next = [...new Set(list.map((c) => (c === from ? to : c)))];
  const { error } = await supabase
    .from("businesses")
    .update({ blog_categories: next })
    .eq("id", businessId);
  if (error) return { error: ko ? "변경에 실패했습니다." : "Failed to rename." };
  // 글의 category도 함께 이동
  await supabase
    .from("blog_posts")
    .update({ category: to })
    .eq("business_id", businessId)
    .eq("category", from);

  revalidatePath(`/business/${businessId}/blog`);
  return { ok: true, message: ko ? "카테고리를 변경했습니다." : "Renamed." };
}

/** 카테고리 삭제 — 관리 목록에서 제거하고, 해당 글들은 미분류(null)로. */
export async function deleteBlogCategoryAction(
  businessId: string,
  name: string,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  const target = name.trim();
  if (!target) return { error: ko ? "카테고리명을 입력하세요." : "Enter a name." };

  const list = await readBlogCategories(supabase, businessId);
  const next = list.filter((c) => c !== target);
  const { error } = await supabase
    .from("businesses")
    .update({ blog_categories: next })
    .eq("id", businessId);
  if (error) return { error: ko ? "삭제에 실패했습니다." : "Failed to delete." };
  // 해당 카테고리 글은 미분류 처리
  await supabase
    .from("blog_posts")
    .update({ category: null })
    .eq("business_id", businessId)
    .eq("category", target);

  revalidatePath(`/business/${businessId}/blog`);
  return { ok: true, message: ko ? "카테고리를 삭제했습니다." : "Deleted." };
}

/**
 * 설정 페이지에서 개별 사이트의 헤더 로고만 바꾼다.
 * 전체 콘텐츠를 클라이언트로 주고받지 않도록, 서버에서 현재 content를 읽어 hero.logo만 교체한다.
 * logoUrl이 null이면 로고를 제거한다(헤더는 hero 사진으로 자동 대체).
 */
export async function updateSiteLogoAction(
  businessId: string,
  logoUrl: string | null,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { data: site } = await supabase
    .from("websites")
    .select("content")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!site)
    return { error: ko ? "사이트를 찾을 수 없습니다." : "Site not found." };

  const content = site.content as WebsiteContent;
  const next: WebsiteContent = {
    ...content,
    hero: { ...content.hero, logo: logoUrl ?? undefined },
  };
  const { error } = await supabase
    .from("websites")
    .update({ content: next })
    .eq("business_id", businessId);
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  revalidatePath(`/business/${businessId}/website`);
  revalidatePath("/dashboard/settings");
  return { ok: true, message: ko ? "저장되었습니다." : "Saved." };
}

/** 사업체 업종(대분류)을 저장한다. 빈 값이면 미설정으로 지운다. */
export async function updateBusinessIndustryAction(
  businessId: string,
  industry: string,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  if (industry && !INDUSTRY_IDS.includes(industry as IndustryId))
    return { error: ko ? "올바른 업종이 아닙니다." : "Invalid industry." };

  const { error } = await supabase
    .from("businesses")
    .update({ industry: industry || null })
    .eq("id", businessId);
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  revalidatePath(`/business/${businessId}/brand`);
  revalidatePath("/showcase");
  return { ok: true, message: ko ? "저장되었습니다." : "Saved." };
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
  const ko = (await getLocale()) === "ko";
  const takenMsg = ko
    ? "이미 다른 사이트가 사용 중인 주소입니다."
    : "That address is already in use by another site.";
  const failMsg = ko
    ? "주소 변경에 실패했습니다."
    : "Failed to change the address.";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const slug = slugify(rawSlug);
  if (slug.length < 3)
    return {
      error: ko
        ? "주소는 영문 소문자·숫자·하이픈으로 3자 이상이어야 합니다."
        : "The address must be at least 3 characters using lowercase letters, numbers, and hyphens.",
    };

  // 브랜드·시스템 예약어는 사용자 사이트 주소로 쓸 수 없다.
  const RESERVED = new Set([
    "storyup", "admin", "api", "www", "app", "dashboard", "site", "blog",
  ]);
  if (RESERVED.has(slug))
    return {
      error: ko
        ? "사용할 수 없는 주소입니다. 다른 주소를 입력해주세요."
        : "That address is reserved. Please choose another one.",
    };

  // Ownership check via RLS (+ old slug for revalidation).
  const { data: biz } = await supabase
    .from("businesses")
    .select("slug")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz)
    return { error: ko ? "권한이 없습니다." : "You don't have permission." };

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
  if (takenBiz || takenSite) return { error: takenMsg };

  const { error: bizErr } = await supabase
    .from("businesses")
    .update({ slug })
    .eq("id", businessId);
  if (bizErr)
    return { error: bizErr.code === "23505" ? takenMsg : failMsg };

  // 웹사이트가 아직 없으면 0행 업데이트로 무해하게 지나간다.
  const { error: siteErr } = await supabase
    .from("websites")
    .update({ slug })
    .eq("business_id", businessId);
  if (siteErr) {
    // 원자성이 없으므로 실패 시 비즈니스 슬러그를 되돌린다.
    await supabase.from("businesses").update({ slug: biz.slug }).eq("id", businessId);
    return { error: siteErr.code === "23505" ? takenMsg : failMsg };
  }

  revalidatePath(`/business/${businessId}/website`);
  revalidatePath(`/site/${biz.slug}`);
  revalidatePath(`/site/${biz.slug}/blog`);
  revalidatePath(`/site/${slug}`);
  revalidatePath(`/site/${slug}/blog`);
  // 슬러그 변경은 sitemap의 모든 해당 URL을 바꾼다
  revalidatePath("/sitemap.xml");
  return {
    ok: true,
    slug,
    message: ko ? "사이트 주소가 변경되었습니다." : "Site address updated.",
  };
}

export async function publishWebsiteAction(
  businessId: string,
  publish: boolean,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

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
  if (error)
    return { error: ko ? "처리에 실패했습니다." : "Something went wrong." };

  // 성장 활동 — 게시 상태 변경도 홈페이지 관리 활동으로 인정
  if (publish) await trackGrowthActivity(user.id, "site_updated");

  revalidatePath(`/business/${businessId}/website`);
  // 사이트 공개/비공개는 사이트·소속 글 전체의 sitemap 노출에 영향
  revalidatePath("/sitemap.xml");
  if (web?.slug) revalidatePath(`/site/${web.slug}`);
  return {
    ok: true,
    message: publish
      ? ko
        ? "랜딩페이지가 공개되었습니다."
        : "Your landing page is now live."
      : ko
        ? "비공개로 전환되었습니다."
        : "Your landing page is now private.",
  };
}

// ---------------- Blog ----------------

export async function saveBlogAction(
  businessId: string,
  postId: string,
  fields: { title: string; content: string; summary: string; category?: string },
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const base = {
    title: fields.title,
    content: fields.content,
    summary: fields.summary,
  };
  const withCategory =
    fields.category !== undefined
      ? { ...base, category: fields.category.trim() || null }
      : base;

  let { error } = await supabase
    .from("blog_posts")
    .update(withCategory)
    .eq("id", postId)
    .eq("business_id", businessId);
  // category 컬럼 마이그레이션(0013) 이전 DB에서는 컬럼 없이 저장한다.
  if (error && "category" in withCategory && error.code === "PGRST204") {
    ({ error } = await supabase
      .from("blog_posts")
      .update(base)
      .eq("id", postId)
      .eq("business_id", businessId));
  }
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  // 성장 활동 — 콘텐츠 수정 (스트릭·미션 인정, 별도 UP 지급 없음)
  await trackGrowthActivity(user.id, "blog_edited", postId);

  revalidatePath(`/business/${businessId}/blog/${postId}`);
  // 공개된 글이면 공개 페이지 캐시도 갱신 (커버 변경과 동일한 규칙)
  const { data: saved } = await supabase
    .from("blog_posts")
    .select("slug, status")
    .eq("id", postId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (saved?.status === "published") {
    const { data: web } = await supabase
      .from("websites")
      .select("slug")
      .eq("business_id", businessId)
      .maybeSingle();
    if (web?.slug) {
      revalidatePath(`/site/${web.slug}`);
      revalidatePath(`/site/${web.slug}/blog`);
      revalidatePath(`/site/${web.slug}/blog/${saved.slug}`);
    }
    // 수정 시각(lastmod) 변경을 sitemap에 즉시 반영
    revalidatePath("/sitemap.xml");
  }
  return { ok: true, message: ko ? "저장되었습니다." : "Saved." };
}

/** Sets (or clears) a blog post's cover image URL. */
export async function updateBlogCoverAction(
  businessId: string,
  postId: string,
  url: string | null,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { data: post } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("id", postId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!post)
    return { error: ko ? "글을 찾을 수 없습니다." : "Post not found." };

  const { error } = await supabase
    .from("blog_posts")
    .update({ cover_image_url: url })
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  const { data: web } = await supabase
    .from("websites")
    .select("slug")
    .eq("business_id", businessId)
    .maybeSingle();

  revalidatePath(`/business/${businessId}/blog/${postId}`);
  if (web?.slug) {
    // 커버는 랜딩페이지 '최신 글' 섹션에도 노출된다
    revalidatePath(`/site/${web.slug}`);
    revalidatePath(`/site/${web.slug}/blog`);
    revalidatePath(`/site/${web.slug}/blog/${post.slug}`);
  }
  return {
    ok: true,
    message: url
      ? ko
        ? "커버 이미지가 저장되었습니다."
        : "Cover image saved."
      : ko
        ? "기본 커버로 변경되었습니다."
        : "Reset to the default cover.",
  };
}

export async function publishBlogAction(
  businessId: string,
  postId: string,
  publish: boolean,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

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

  // 즉시 발행/비공개 전환 시 예약(scheduled_at)은 항상 해제한다.
  const patch = {
    status: (publish ? "published" : "draft") as "published" | "draft",
    published_at: publish ? new Date().toISOString() : null,
    scheduled_at: null as string | null,
  };
  let { error } = await supabase
    .from("blog_posts")
    .update(patch)
    .eq("id", postId)
    .eq("business_id", businessId);
  // scheduled_at 컬럼(0024) 이전 DB에서는 컬럼 없이 저장한다.
  if (error && error.code === "PGRST204") {
    const { scheduled_at: _omit, ...base } = patch;
    void _omit;
    ({ error } = await supabase
      .from("blog_posts")
      .update(base)
      .eq("id", postId)
      .eq("business_id", businessId));
  }
  if (error)
    return { error: ko ? "처리에 실패했습니다." : "Something went wrong." };

  // 성장 보상 — 발행 시 1회 (멱등키: 글 ID, 재발행 중복 지급 없음)
  if (publish) await trackGrowthActivity(user.id, "blog_published", postId);

  revalidatePath(`/business/${businessId}/blog`);
  // 발행/비공개 전환 시 sitemap을 즉시 갱신 (기본 1시간 캐시를 기다리지 않음)
  revalidatePath("/sitemap.xml");
  if (web?.slug) {
    // 랜딩페이지 '최신 글' 섹션도 즉시 갱신되도록 루트 경로까지 재검증
    revalidatePath(`/site/${web.slug}`);
    revalidatePath(`/site/${web.slug}/blog`);
    if (post?.slug) revalidatePath(`/site/${web.slug}/blog/${post.slug}`);
  }
  return {
    ok: true,
    message: publish
      ? ko
        ? "블로그 글이 공개되었습니다."
        : "Blog post published."
      : ko
        ? "비공개로 전환되었습니다."
        : "Blog post set to private.",
  };
}

/**
 * 블로그 예약 발행 — scheduledAt(미래)이면 status=draft로 두고 예약 시각만 기록한다.
 * 크론(/api/cron/publish)이 시각 도래 시 published로 전환. null이면 예약 취소.
 */
export async function scheduleBlogAction(
  businessId: string,
  postId: string,
  scheduledAtIso: string | null,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  let when: string | null = null;
  if (scheduledAtIso) {
    // 예약 발행은 Pro 이상 전용(취소는 항상 허용).
    if (!getPlanById(await getPlanId(user.id)).scheduledPublish)
      return {
        error: ko
          ? "콘텐츠 예약 발행은 Pro 플랜에서 사용할 수 있어요. 플랜을 업그레이드해주세요."
          : "Scheduled publishing is available on the Pro plan. Please upgrade.",
      };
    const t = new Date(scheduledAtIso);
    if (Number.isNaN(t.getTime()))
      return { error: ko ? "예약 시각이 올바르지 않습니다." : "Invalid date." };
    if (t.getTime() < Date.now() + 60_000)
      return {
        error: ko
          ? "예약 시각은 현재보다 최소 1분 이후여야 합니다."
          : "Scheduled time must be at least 1 minute in the future.",
      };
    when = t.toISOString();
  }

  // 예약 = 아직 비공개(draft) 유지 + 예약 시각 기록 (도래 시 크론이 공개로 전환)
  const { error } = await supabase
    .from("blog_posts")
    .update({ status: "draft", published_at: null, scheduled_at: when })
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error) {
    if (error.code === "PGRST204")
      return {
        error: ko
          ? "예약 기능이 아직 활성화되지 않았습니다. (0024 마이그레이션 필요)"
          : "Scheduling is not enabled yet (migration 0024 required).",
      };
    return { error: ko ? "예약에 실패했습니다." : "Failed to schedule." };
  }

  revalidatePath(`/business/${businessId}/blog`);
  revalidatePath(`/business/${businessId}/blog/${postId}`);
  if (!when)
    return {
      ok: true,
      message: ko ? "예약이 취소되었습니다." : "Schedule canceled.",
    };
  const label = new Date(when).toLocaleString(ko ? "ko-KR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return {
    ok: true,
    message: ko
      ? `${label}에 발행 예약되었습니다.`
      : `Scheduled to publish on ${label}.`,
  };
}

/**
 * 카드뉴스 배경 이미지 URL 목록을 저장한다 (스튜디오에서 자동 호출).
 * marketing_contents의 카드뉴스 JSON에 images 배열을 병합해,
 * 새로고침·쇼케이스에서도 배경이 유지되게 한다.
 */
export async function saveCardImagesAction(
  businessId: string,
  blogPostId: string,
  images: (string | null)[],
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // 스토리지 URL만 저장한다 — data URL은 행 크기를 폭증시키므로 제외.
  const clean = images
    .slice(0, 12)
    .map((u) =>
      typeof u === "string" && /^https?:\/\//.test(u) ? u.slice(0, 600) : null,
    );

  // 소유권 확인은 RLS가 걸린 사용자 클라이언트 조회로 한다.
  const { data: row } = await supabase
    .from("marketing_contents")
    .select("id, content")
    .eq("business_id", businessId)
    .eq("blog_post_id", blogPostId)
    .eq("platform", "instagram_cards")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row)
    return {
      error: ko ? "카드뉴스를 찾을 수 없습니다." : "Card news not found.",
    };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(row.content) as Record<string, unknown>;
  } catch {
    return { error: ko ? "저장에 실패했습니다." : "Failed to save." };
  }
  parsed.images = clean;

  // marketing_contents에는 UPDATE RLS가 없어 관리자 클라이언트로 쓴다.
  const admin = createAdminClient();
  const { error } = await admin
    .from("marketing_contents")
    .update({ content: JSON.stringify(parsed) })
    .eq("id", row.id);
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };
  return { ok: true };
}

/**
 * 공유용 대표 이미지(렌더된 커버 카드) URL을 카드뉴스 content.shareImage에 저장한다.
 * /cards/{id} 공유 페이지의 og:image로 쓰여 페이스북 등에서 글처럼 이미지가 먼저 보인다.
 */
export async function saveCardShareImageAction(
  businessId: string,
  blogPostId: string,
  url: string,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  if (typeof url !== "string" || !/^https?:\/\//.test(url))
    return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  // 소유권 확인은 RLS가 걸린 사용자 클라이언트 조회로 한다.
  const { data: row } = await supabase
    .from("marketing_contents")
    .select("id, content")
    .eq("business_id", businessId)
    .eq("blog_post_id", blogPostId)
    .eq("platform", "instagram_cards")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row)
    return { error: ko ? "카드뉴스를 찾을 수 없습니다." : "Card news not found." };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(row.content) as Record<string, unknown>;
  } catch {
    return { error: ko ? "저장에 실패했습니다." : "Failed to save." };
  }
  parsed.shareImage = url.slice(0, 600);

  // marketing_contents에는 UPDATE RLS가 없어 관리자 클라이언트로 쓴다.
  const admin = createAdminClient();
  const { error } = await admin
    .from("marketing_contents")
    .update({ content: JSON.stringify(parsed) })
    .eq("id", row.id);
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };
  return { ok: true };
}

/** 카드뉴스 텍스트/스타일 편집 저장 — cover·slides·cta·cardStyles를 저장 content에 병합(images 보존). */
export async function saveCardNewsAction(
  businessId: string,
  blogPostId: string,
  patch: {
    cover?: unknown;
    slides?: unknown;
    cta?: unknown;
    cardStyles?: unknown;
  },
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { data: row } = await supabase
    .from("marketing_contents")
    .select("id, content")
    .eq("business_id", businessId)
    .eq("blog_post_id", blogPostId)
    .eq("platform", "instagram_cards")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row)
    return { error: ko ? "카드뉴스를 찾을 수 없습니다." : "Card news not found." };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(row.content) as Record<string, unknown>;
  } catch {
    return { error: ko ? "저장에 실패했습니다." : "Failed to save." };
  }
  if (patch.cover !== undefined) parsed.cover = patch.cover;
  if (patch.slides !== undefined) parsed.slides = patch.slides;
  if (patch.cta !== undefined) parsed.cta = patch.cta;
  if (patch.cardStyles !== undefined) parsed.cardStyles = patch.cardStyles;

  const admin = createAdminClient();
  const { error } = await admin
    .from("marketing_contents")
    .update({ content: JSON.stringify(parsed) })
    .eq("id", row.id);
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };
  return { ok: true };
}

/**
 * 쇼츠 생성 쿼터 1회 소비(생성 시작 시 호출). 플랜(BASIC·Pro·Partner)과 이번 달
 * 사용량을 서버에서 검증하고 usage_events에 기록한다. 실제 영상은 클라이언트에서
 * 로컬 생성하므로(패킷 최소), 여기서는 권한·한도만 확인한다.
 */
export async function reserveShortsQuota(businessId: string): Promise<{
  ok?: true;
  used?: number;
  limit?: number | null;
  error?: string;
}> {
  const ko = (await getLocale()) === "ko";
  if (!SHORTS_ENABLED)
    return {
      error: ko ? "쇼츠 기능은 준비 중입니다." : "Shorts are coming soon.",
    };
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // 소유권 확인(RLS).
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz)
    return { error: ko ? "권한이 없습니다." : "You don't have permission." };

  const { planId, limit, used } = await getShortsQuota(user.id);
  if (planId === "free" || limit === 0)
    return {
      error: ko
        ? "쇼츠 만들기는 BASIC·Pro 플랜에서 사용할 수 있어요. 플랜을 업그레이드해주세요."
        : "Shorts are available on the BASIC and Pro plans. Please upgrade.",
    };
  if (limit !== null && used >= limit)
    return {
      error: ko
        ? `이번 달 쇼츠 ${limit}회를 모두 사용했어요. 다음 달에 다시 이용해주세요.`
        : `You've used all ${limit} shorts this month. Please try again next month.`,
      used,
      limit,
    };

  const admin = createAdminClient();
  const { error } = await admin
    .from("usage_events")
    .insert({ user_id: user.id, kind: "shorts", charged: 0 });
  if (error) {
    console.error("[reserveShortsQuota] insert failed", error);
    return { error: ko ? "잠시 후 다시 시도해주세요." : "Please try again." };
  }
  return { ok: true, used: used + 1, limit };
}

/**
 * 쇼츠 유튜브 업로드용 단기 access_token 발급(Pro 전용). refresh_token은 서버에만
 * 두고, 브라우저는 이 토큰으로 유튜브에 영상을 직접 올린다(패킷 최소).
 */
export async function mintYoutubeUploadToken(): Promise<{
  token?: string;
  error?: string;
}> {
  const ko = (await getLocale()) === "ko";
  const { user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  const planId = await getPlanId(user.id);
  if (planId !== "pro" && planId !== "partner")
    return {
      error: ko
        ? "유튜브 업로드는 Pro 플랜에서 사용할 수 있어요."
        : "YouTube upload is available on the Pro plan.",
    };
  const refresh = await getRefreshToken(user.id);
  if (!refresh)
    return {
      error: ko
        ? "먼저 구글 계정(유튜브)을 연결해주세요."
        : "Connect your Google (YouTube) account first.",
    };
  try {
    const token = await refreshAccessToken(refresh);
    return { token };
  } catch {
    return {
      error: ko
        ? "유튜브 토큰 발급에 실패했어요. 계정을 다시 연결해주세요."
        : "Could not get a YouTube token. Please reconnect your account.",
    };
  }
}

/** 유튜브 연결 해제. */
export async function disconnectYoutubeAction(): Promise<{
  ok?: true;
  error?: string;
}> {
  const ko = (await getLocale()) === "ko";
  const { user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  await disconnectYoutube(user.id);
  return { ok: true };
}

/** 무료 플랜 블로그 이용 '재신청' — 관리자 승인 대기 요청을 만든다. */
export async function requestFreeReapplyAction(): Promise<{
  ok?: true;
  error?: string;
}> {
  const ko = (await getLocale()) === "ko";
  const { user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  return requestFreeReapply(user.id, ko);
}

export async function deleteBlogAction(
  businessId: string,
  postId: string,
): Promise<ActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { error } = await supabase
    .from("blog_posts")
    .delete()
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error)
    return { error: ko ? "삭제에 실패했습니다." : "Failed to delete." };

  revalidatePath(`/business/${businessId}/blog`);
  return { ok: true };
}
