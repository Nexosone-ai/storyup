"use server";

import { randomInt } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { notifyBlogEngagement } from "@/lib/notifications";

/**
 * 공개 블로그 글의 "이벤트" 모듈 액션 (쿠폰 수령 · 연락문의).
 * 방문자는 STORYUP 로그인 상태가 아니므로 coupon_claims / site_inquiries에는 쓰기 RLS가 없고,
 * 여기서 글이 공개 상태인지 검증한 뒤 관리자 클라이언트로 접수한다. 문구는 글 언어(lang)를 따른다.
 * 로그에 방문자 개인정보(이름·전화)를 남기지 않는다.
 */

/** 혼동되는 문자(0/O/1/I)를 뺀 6자리 수령 코드. */
function makeCouponCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
  return code;
}

/** 전화번호를 숫자만 남겨 정규화 (본인확인·중복 판정 기준). */
function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/** 오늘 날짜(Asia/Seoul, YYYY-MM-DD) — DATE 컬럼과 문자열 비교용. */
function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export interface CouponClaimState {
  error?: string;
  ok?: boolean;
  /** 발급(또는 기존) 코드 */
  code?: string;
  /** 이미 받은 적이 있어 기존 코드를 돌려준 경우 */
  already?: boolean;
}

export async function claimCouponAction(
  postId: string,
  input: { name: string; phone: string },
  lang: "ko" | "en" = "ko",
): Promise<CouponClaimState> {
  const ko = lang === "ko";
  const name = input.name.trim().slice(0, 60);
  const phone = normalizePhone(input.phone);

  if (!name)
    return { error: ko ? "이름을 입력해주세요." : "Please enter your name." };
  if (phone.length < 9 || phone.length > 11)
    return {
      error: ko
        ? "휴대폰 번호를 정확히 입력해주세요."
        : "Please enter a valid phone number.",
    };

  const admin = createAdminClient();
  const { data: post } = await admin
    .from("blog_posts")
    .select("id, status")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.status !== "published")
    return { error: ko ? "글을 찾을 수 없습니다." : "Post not found." };

  const { data: event } = await admin
    .from("blog_events")
    .select("*")
    .eq("post_id", postId)
    .maybeSingle();
  if (!event || !event.coupon_enabled || !event.coupon_benefit)
    return {
      error: ko
        ? "진행 중인 쿠폰 이벤트가 아닙니다."
        : "No active coupon event.",
    };

  const today = todayKST();
  if (event.coupon_issued_on && today < event.coupon_issued_on)
    return {
      error: ko
        ? `아직 발행 전이에요. ${event.coupon_issued_on}부터 받을 수 있어요.`
        : `Not available yet. Claimable from ${event.coupon_issued_on}.`,
    };
  if (event.coupon_valid_until && today > event.coupon_valid_until)
    return {
      error: ko
        ? "쿠폰 사용 기간이 종료되었어요."
        : "This coupon has expired.",
    };

  // 이미 받은 번호면 기존 코드를 그대로 돌려준다 (본인확인 = 번호당 1매).
  const { data: existing } = await admin
    .from("coupon_claims")
    .select("code")
    .eq("event_id", event.id)
    .eq("phone", phone)
    .maybeSingle();
  if (existing)
    return { ok: true, code: existing.code, already: true };

  // 사용한도(총 발급 수량) 확인
  if (event.coupon_limit != null) {
    const { count } = await admin
      .from("coupon_claims")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    if ((count ?? 0) >= event.coupon_limit)
      return {
        error: ko
          ? "쿠폰이 모두 소진되었어요."
          : "All coupons have been claimed.",
      };
  }

  const code = makeCouponCode();
  const { error } = await admin.from("coupon_claims").insert({
    event_id: event.id,
    business_id: event.business_id,
    name,
    phone,
    code,
  });
  if (error) {
    // 동시 수령으로 unique(event_id, phone) 충돌 → 기존 코드 반환
    if (error.code === "23505") {
      const { data: dup } = await admin
        .from("coupon_claims")
        .select("code")
        .eq("event_id", event.id)
        .eq("phone", phone)
        .maybeSingle();
      if (dup) return { ok: true, code: dup.code, already: true };
    }
    return {
      error: ko
        ? "쿠폰 발급에 실패했어요. 잠시 후 다시 시도해주세요."
        : "Failed to issue the coupon. Please try again.",
    };
  }

  // 글 주인에게 앱 내 알림 (실패해도 수령은 성공 처리)
  await notifyBlogEngagement(admin, {
    postId,
    type: "coupon_claim",
    actorName: name,
    preview: event.coupon_benefit,
  });

  return { ok: true, code };
}

export interface EventInquiryState {
  error?: string;
  ok?: boolean;
}

export async function createEventInquiryAction(
  postId: string,
  input: { name: string; phone: string; message?: string },
  lang: "ko" | "en" = "ko",
): Promise<EventInquiryState> {
  const ko = lang === "ko";
  const name = input.name.trim().slice(0, 60);
  const phone = input.phone.trim().slice(0, 40);
  const message = (input.message ?? "").trim().slice(0, 2000);

  if (!name)
    return { error: ko ? "이름을 입력해주세요." : "Please enter your name." };
  if (normalizePhone(phone).length < 9)
    return {
      error: ko
        ? "휴대폰 번호를 정확히 입력해주세요."
        : "Please enter a valid phone number.",
    };

  const admin = createAdminClient();
  const { data: post } = await admin
    .from("blog_posts")
    .select("id, business_id, status")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.status !== "published")
    return { error: ko ? "글을 찾을 수 없습니다." : "Post not found." };

  const { error } = await admin.from("site_inquiries").insert({
    business_id: post.business_id,
    blog_post_id: post.id,
    name,
    contact: phone,
    message: message || (ko ? "(연락 요청)" : "(Requested a callback)"),
  });
  if (error)
    return {
      error: ko
        ? "문의 전송에 실패했어요. 잠시 후 다시 시도해주세요."
        : "Failed to send. Please try again in a moment.",
    };

  // 글 주인에게 앱 내 알림 (site_inquiry — 랜딩페이지 문의와 같은 문의함)
  await notifyBlogEngagement(admin, {
    postId,
    type: "site_inquiry",
    actorName: name,
    preview: message || phone,
  });

  return { ok: true };
}
