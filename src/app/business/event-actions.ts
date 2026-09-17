"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";

/**
 * 블로그 이벤트(쿠폰발행 + 연락문의) 소유자 액션.
 * 모든 쓰기는 RLS(owns_business) 클라이언트로 수행 — 권한은 정책이 강제한다.
 */

export interface EventActionState {
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

export interface BlogEventConfig {
  couponEnabled: boolean;
  couponBenefit: string;
  couponIssuedOn: string | null;
  couponLimit: number | null;
  couponValidFrom: string | null;
  couponValidUntil: string | null;
  contactEnabled: boolean;
  contactTitle: string;
  contactDesc: string;
  commentEnabled: boolean;
  addressEnabled: boolean;
  mapEnabled: boolean;
}

/** 공개 페이지 캐시 갱신 — 공개된 글일 때만 랜딩/글 경로를 무효화. */
async function revalidatePublicPost(
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

/** 이벤트 설정 저장 (글당 1개, 없으면 생성). */
export async function saveBlogEventAction(
  businessId: string,
  postId: string,
  config: BlogEventConfig,
): Promise<EventActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // 소유 글인지 확인 (RLS로도 막히지만 명확한 메시지를 위해 선확인)
  const { data: post } = await supabase
    .from("blog_posts")
    .select("id")
    .eq("id", postId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!post)
    return { error: ko ? "글을 찾을 수 없습니다." : "Post not found." };

  const benefit = config.couponBenefit.trim();
  if (config.couponEnabled && !benefit)
    return {
      error: ko
        ? "쿠폰 혜택 내용을 입력해주세요."
        : "Please enter the coupon benefit.",
    };
  const limit =
    config.couponLimit != null && config.couponLimit > 0
      ? Math.floor(config.couponLimit)
      : null;
  const emptyToNull = (v: string | null) => (v && v.trim() ? v : null);

  const { error } = await supabase.from("blog_events").upsert(
    {
      post_id: postId,
      business_id: businessId,
      coupon_enabled: config.couponEnabled,
      coupon_benefit: benefit || null,
      coupon_issued_on: emptyToNull(config.couponIssuedOn),
      coupon_limit: limit,
      coupon_valid_from: emptyToNull(config.couponValidFrom),
      coupon_valid_until: emptyToNull(config.couponValidUntil),
      contact_enabled: config.contactEnabled,
      contact_title: config.contactTitle.trim() || null,
      contact_desc: config.contactDesc.trim() || null,
      comment_enabled: config.commentEnabled,
      address_enabled: config.addressEnabled,
      map_enabled: config.mapEnabled,
    },
    { onConflict: "post_id" },
  );
  if (error)
    return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  revalidatePath(`/business/${businessId}/blog/${postId}`);
  await revalidatePublicPost(supabase, businessId, postId);
  return { ok: true, message: ko ? "이벤트가 저장되었습니다." : "Event saved." };
}

export interface BlogModuleDefaults {
  commentEnabled: boolean;
  addressEnabled: boolean;
  mapEnabled: boolean;
  contactEnabled: boolean;
  contactTitle: string;
  contactDesc: string;
}

/**
 * 하단 모듈(댓글·주소·정보·지도·연락문의)을 이 사업체의 모든 글에 일괄 적용.
 * 쿠폰은 글마다 혜택·수량이 달라 제외한다 — 기존 글의 쿠폰 설정은 보존한다
 * (upsert가 전달한 컬럼만 갱신하므로 coupon_* 컬럼은 건드리지 않는다).
 */
export async function applyBlogModulesToAllAction(
  businessId: string,
  config: BlogModuleDefaults,
): Promise<EventActionState & { count?: number }> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // 소유 사업체의 모든 글 id (RLS가 소유 글로 한정).
  const { data: posts, error: postsErr } = await supabase
    .from("blog_posts")
    .select("id")
    .eq("business_id", businessId);
  if (postsErr)
    return { error: ko ? "글 목록을 불러오지 못했습니다." : "Failed to load posts." };
  if (!posts || posts.length === 0)
    return { ok: true, count: 0, message: ko ? "적용할 글이 없습니다." : "No posts to apply." };

  const title = config.contactTitle.trim() || null;
  const desc = config.contactDesc.trim() || null;
  const rows = posts.map((p) => ({
    post_id: p.id,
    business_id: businessId,
    comment_enabled: config.commentEnabled,
    address_enabled: config.addressEnabled,
    map_enabled: config.mapEnabled,
    contact_enabled: config.contactEnabled,
    contact_title: title,
    contact_desc: desc,
  }));

  // onConflict=post_id → 기존 행은 위 모듈 컬럼만 갱신(쿠폰 보존), 없으면 새로 생성.
  const { error } = await supabase
    .from("blog_events")
    .upsert(rows, { onConflict: "post_id" });
  if (error)
    return { error: ko ? "일괄 적용에 실패했습니다." : "Failed to apply to all." };

  revalidatePath(`/business/${businessId}`);
  return {
    ok: true,
    count: posts.length,
    message: ko
      ? `${posts.length}개 글에 동일하게 적용했습니다.`
      : `Applied to ${posts.length} posts.`,
  };
}

/** 쿠폰 사용처리 토글 (매장에서 사용 완료 체크). */
export async function setCouponUsedAction(
  businessId: string,
  claimId: string,
  used: boolean,
): Promise<EventActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { error } = await supabase
    .from("coupon_claims")
    .update({ used_at: used ? new Date().toISOString() : null })
    .eq("id", claimId)
    .eq("business_id", businessId);
  if (error)
    return { error: ko ? "처리에 실패했습니다." : "Failed to update." };
  return { ok: true };
}

/** 쿠폰 수령 기록 삭제. */
export async function deleteCouponClaimAction(
  businessId: string,
  claimId: string,
): Promise<EventActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { error } = await supabase
    .from("coupon_claims")
    .delete()
    .eq("id", claimId)
    .eq("business_id", businessId);
  if (error)
    return { error: ko ? "삭제에 실패했습니다." : "Failed to delete." };
  return { ok: true };
}
