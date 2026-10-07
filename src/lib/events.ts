import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import type { BlogEventRow, Database } from "@/types/database";

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
  contactTitle: string | null;
  contactDesc: string | null;
  commentEnabled: boolean;
  addressEnabled: boolean;
  mapEnabled: boolean;
  reservationEnabled: boolean;
  reservationTitle: string | null;
  reservationDesc: string | null;
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
  // 행이 있으면 모든 모듈 플래그를 반환한다(댓글 등은 페이지에서 개별 게이팅).
  if (!event) return null;

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

  // 예약(Pro+) 다운그레이드 즉시 반영 — 소유자 플랜이 더 이상 예약을 허용하지
  // 않으면(해지·만료·갱신 실패 → free 취급) 공개 페이지에서 예약 폼을 숨긴다.
  let reservationEnabled = event.reservation_enabled ?? false;
  if (reservationEnabled) {
    const { data: biz } = await admin
      .from("businesses")
      .select("user_id")
      .eq("id", event.business_id)
      .maybeSingle();
    const allowed = biz
      ? getPlanById(await getPlanId(biz.user_id)).reservation === true
      : false;
    if (!allowed) reservationEnabled = false;
  }

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
    contactTitle: event.contact_title,
    contactDesc: event.contact_desc,
    // 0030 이전 DB에서는 컬럼이 없어 undefined — 댓글은 기본 노출, 나머지는 숨김.
    commentEnabled: event.comment_enabled ?? true,
    addressEnabled: event.address_enabled ?? false,
    mapEnabled: event.map_enabled ?? false,
    // 0050 이전 DB에서는 컬럼이 없어 undefined — 예약은 기본 숨김.
    // reservationEnabled 는 위에서 소유자 플랜(Pro+)까지 반영해 계산한다.
    reservationEnabled,
    reservationTitle: event.reservation_title ?? null,
    reservationDesc: event.reservation_desc ?? null,
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

export interface UserCouponClaim {
  id: string;
  name: string;
  phone: string;
  code: string;
  used_at: string | null;
  created_at: string;
  businessId: string;
  businessName: string;
  postId: string | null;
  postTitle: string;
  benefit: string;
}

/**
 * 대시보드 '문의/쿠폰관리'용 — 로그인 사용자의 모든 비즈니스에 걸친 쿠폰 수령자.
 * RLS(coupon_claims owner_read)가 본인 소유 건으로 한정한다.
 * 각 수령에 어느 글·어떤 혜택인지 맥락(글 제목·혜택)을 붙여 돌려준다.
 */
export async function getUserCouponClaims(): Promise<UserCouponClaim[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: bizList } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", user.id);
  const nameMap = new Map((bizList ?? []).map((b) => [b.id, b.name]));

  const { data: claims, error } = await supabase
    .from("coupon_claims")
    .select("*")
    .order("created_at", { ascending: false });
  // 0027 마이그레이션 이전 DB에서는 테이블이 없어 오류 → 빈 목록.
  if (error || !claims?.length) return [];

  const eventIds = [...new Set(claims.map((c) => c.event_id))];
  const { data: events } = await supabase
    .from("blog_events")
    .select("id, post_id, coupon_benefit")
    .in("id", eventIds);
  const eventMap = new Map((events ?? []).map((e) => [e.id, e]));

  const postIds = [...new Set((events ?? []).map((e) => e.post_id))];
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title")
    .in("id", postIds);
  const postMap = new Map((posts ?? []).map((p) => [p.id, p.title]));

  return claims.map((c) => {
    const ev = eventMap.get(c.event_id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      code: c.code,
      used_at: c.used_at,
      created_at: c.created_at,
      businessId: c.business_id,
      businessName: nameMap.get(c.business_id) ?? "",
      postId: ev?.post_id ?? null,
      postTitle: ev ? (postMap.get(ev.post_id) ?? "") : "",
      benefit: ev?.coupon_benefit ?? "",
    };
  });
}

export type ReservationStatus = "pending" | "confirmed" | "cancelled";

export interface UserReservation {
  id: string;
  name: string;
  phone: string;
  partySize: number | null;
  desiredDate: string | null;
  desiredTime: string | null;
  note: string | null;
  status: ReservationStatus;
  created_at: string;
  businessId: string;
  businessName: string;
  postId: string | null;
  postTitle: string;
}

/**
 * 대시보드 '예약' 탭용 — 로그인 사용자의 모든 비즈니스에 걸친 예약 요청.
 * RLS(reservation_requests owner_read)가 본인 소유 건으로 한정한다.
 * 각 예약에 어느 글에서 왔는지(글 제목) 맥락을 붙여 돌려준다.
 */
export async function getUserReservations(): Promise<UserReservation[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: bizList } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", user.id);
  const nameMap = new Map((bizList ?? []).map((b) => [b.id, b.name]));

  const { data: rows, error } = await supabase
    .from("reservation_requests")
    .select("*")
    .order("created_at", { ascending: false });
  // 0050 마이그레이션 이전 DB에서는 테이블이 없어 오류 → 빈 목록.
  if (error || !rows?.length) return [];

  const eventIds = [...new Set(rows.map((r) => r.event_id))];
  const { data: events } = await supabase
    .from("blog_events")
    .select("id, post_id")
    .in("id", eventIds);
  const eventMap = new Map((events ?? []).map((e) => [e.id, e]));

  const postIds = [...new Set((events ?? []).map((e) => e.post_id))];
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title")
    .in("id", postIds);
  const postMap = new Map((posts ?? []).map((p) => [p.id, p.title]));

  return rows.map((r) => {
    const ev = eventMap.get(r.event_id);
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      partySize: r.party_size,
      desiredDate: r.desired_date,
      desiredTime: r.desired_time,
      note: r.note,
      status: r.status,
      created_at: r.created_at,
      businessId: r.business_id,
      businessName: nameMap.get(r.business_id) ?? "",
      postId: ev?.post_id ?? null,
      postTitle: ev ? (postMap.get(ev.post_id) ?? "") : "",
    };
  });
}

/** 편집기 배지용 — 이벤트의 예약 요청 수(소유자 RLS). */
export async function getReservationCount(eventId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("reservation_requests")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  return count ?? 0;
}

/**
 * 새 글에 사업체의 "이벤트 기본값"을 적용한다.
 * 사장님이 '모든 글에 동일 적용'으로 맞춰둔 하단 모듈(댓글·주소·지도·연락문의·예약)을
 * 새로 만든 글도 그대로 물려받게 한다. 쿠폰은 글마다 혜택·수량이 달라 제외한다.
 * 기준은 이 사업체에서 가장 최근 수정된 blog_events 행. 없거나 모두 기본값이면 생략한다
 * (blog_events 행이 없는 글 = 댓글 on·나머지 off 와 동일하게 동작하므로).
 * 실패해도 글 생성 흐름을 막지 않는다.
 */
export async function applyEventDefaultsToNewPost(
  supabase: SupabaseClient<Database>,
  businessId: string,
  postId: string,
): Promise<void> {
  try {
    const { data: tmpl } = await supabase
      .from("blog_events")
      .select(
        "comment_enabled, address_enabled, map_enabled, contact_enabled, contact_title, contact_desc, reservation_enabled, reservation_title, reservation_desc",
      )
      .eq("business_id", businessId)
      .neq("post_id", postId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!tmpl) return;

    // 모두 기본값(댓글 on·나머지 off)이면 행을 만들지 않는다(미설정과 동일 동작).
    const meaningful =
      tmpl.comment_enabled === false ||
      !!tmpl.address_enabled ||
      !!tmpl.map_enabled ||
      !!tmpl.contact_enabled ||
      !!tmpl.reservation_enabled;
    if (!meaningful) return;

    await supabase.from("blog_events").insert({
      post_id: postId,
      business_id: businessId,
      comment_enabled: tmpl.comment_enabled ?? true,
      address_enabled: tmpl.address_enabled ?? false,
      map_enabled: tmpl.map_enabled ?? false,
      contact_enabled: tmpl.contact_enabled ?? false,
      contact_title: tmpl.contact_title,
      contact_desc: tmpl.contact_desc,
      reservation_enabled: tmpl.reservation_enabled ?? false,
      reservation_title: tmpl.reservation_title,
      reservation_desc: tmpl.reservation_desc,
      // 쿠폰은 글마다 달라 상속하지 않는다(coupon_* 기본값 유지).
    });
  } catch {
    // 이벤트 기본값 적용 실패는 글 생성 자체를 막지 않는다.
  }
}
