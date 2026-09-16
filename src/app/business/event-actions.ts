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
    },
    { onConflict: "post_id" },
  );
  if (error)
    return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  revalidatePath(`/business/${businessId}/blog/${postId}`);
  await revalidatePublicPost(supabase, businessId, postId);
  return { ok: true, message: ko ? "이벤트가 저장되었습니다." : "Event saved." };
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
