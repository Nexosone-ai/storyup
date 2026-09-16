import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { BlogEventRow, CouponClaimRow } from "@/types/database";

/**
 * 블로그 이벤트(쿠폰발행 + 연락문의) 서버 조회 헬퍼.
 * - 소유자 조회는 RLS 클라이언트(owns_business)로, 공개 페이지 조회는 admin 클라이언트로 한다
 *   (coupon_claims에는 공개 read 정책이 없어 수령 수 집계는 service role이 필요).
 * - 0027 마이그레이션 이전 DB에서는 테이블이 없어 조회가 실패 → null/기본값으로 동작한다.
 */

/** 편집기용 — 글 주인이 자기 글의 이벤트 설정을 읽는다. 없으면 null(미설정). */
export async function getBlogEventForOwner(
  postId: string,
): Promise<BlogEventRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_events")
    .select("*")
    .eq("post_id", postId)
    .maybeSingle();
  return data ?? null;
}

export interface PublicBlogEvent {
  couponEnabled: boolean;
  couponBenefit: string | null;
  couponIssuedOn: string | null;
  couponValidFrom: string | null;
  couponValidUntil: string | null;
  couponLimit: number | null;
  couponClaimed: number;
  couponRemaining: number | null; // null = 무제한
  contactEnabled: boolean;
}

/**
 * 공개 글 페이지용 — 이벤트 설정 + 쿠폰 수령 현황을 함께 반환한다.
 * 활성화된 모듈이 하나도 없으면 null(렌더 생략).
 */
export async function getPublicBlogEvent(
  postId: string,
): Promise<PublicBlogEvent | null> {
  const admin = createAdminClient();
  const { data: event } = await admin
    .from("blog_events")
    .select("*")
    .eq("post_id", postId)
    .maybeSingle();
  if (!event) return null;
  if (!event.coupon_enabled && !event.contact_enabled) return null;

  let couponClaimed = 0;
  if (event.coupon_enabled) {
    const { count } = await admin
      .from("coupon_claims")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    couponClaimed = count ?? 0;
  }
  const couponRemaining =
    event.coupon_limit != null
      ? Math.max(0, event.coupon_limit - couponClaimed)
      : null;

  return {
    couponEnabled: event.coupon_enabled,
    couponBenefit: event.coupon_benefit,
    couponIssuedOn: event.coupon_issued_on,
    couponValidFrom: event.coupon_valid_from,
    couponValidUntil: event.coupon_valid_until,
    couponLimit: event.coupon_limit,
    couponClaimed,
    couponRemaining,
    contactEnabled: event.contact_enabled,
  };
}

/** 편집기 배지용 — 이벤트의 쿠폰 수령 수(소유자 RLS). */
export async function getCouponClaimCount(eventId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("coupon_claims")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  return count ?? 0;
}

/** 관리 페이지용 — 글 주인이 쿠폰 수령자 목록을 읽는다. */
export async function getCouponClaimsForOwner(
  postId: string,
): Promise<{ event: BlogEventRow | null; claims: CouponClaimRow[] }> {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("blog_events")
    .select("*")
    .eq("post_id", postId)
    .maybeSingle();
  if (!event) return { event: null, claims: [] };

  const { data: claims } = await supabase
    .from("coupon_claims")
    .select("*")
    .eq("event_id", event.id)
    .order("created_at", { ascending: false });
  return { event, claims: claims ?? [] };
}
