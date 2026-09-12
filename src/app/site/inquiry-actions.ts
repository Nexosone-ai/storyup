"use server";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * 공개 랜딩페이지 "문의하기" 폼 액션.
 * 방문자는 비로그인 상태이므로 site_inquiries에는 쓰기 RLS가 없고,
 * 여기서 슬러그로 공개 사이트를 검증한 뒤 관리자 클라이언트로 접수한다.
 * 접수되면 사이트 주인(사장님)에게 앱 내 알림을 남긴다. 문구는 사이트 언어를 따른다.
 */

export interface InquiryState {
  error?: string;
  ok?: boolean;
}

export async function createInquiryAction(
  slug: string,
  input: { name: string; contact: string; kakao?: string; message: string },
  lang: "ko" | "en" = "ko",
): Promise<InquiryState> {
  const ko = lang === "ko";
  const name = input.name.trim().slice(0, 60);
  const contact = input.contact.trim().slice(0, 120);
  const kakao = (input.kakao ?? "").trim().slice(0, 120);
  const message = input.message.trim();

  if (!name)
    return { error: ko ? "이름을 입력해주세요." : "Please enter your name." };
  if (!contact)
    return {
      error: ko
        ? "연락처(전화·이메일)를 입력해주세요."
        : "Please enter a contact (phone or email).",
    };
  if (!message)
    return {
      error: ko ? "문의 내용을 입력해주세요." : "Please write your inquiry.",
    };
  if (message.length > 2000)
    return {
      error: ko
        ? "2000자 이내로 작성해주세요."
        : "Please keep it under 2000 characters.",
    };

  const admin = createAdminClient();
  const { data: site } = await admin
    .from("websites")
    .select("business_id, slug")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!site)
    return { error: ko ? "페이지를 찾을 수 없습니다." : "Page not found." };

  const { error } = await admin.from("site_inquiries").insert({
    business_id: site.business_id,
    name,
    contact,
    kakao: kakao || null,
    message,
  });
  if (error)
    return {
      error: ko
        ? "문의 전송에 실패했습니다. 잠시 후 다시 시도해주세요."
        : "Failed to send. Please try again in a moment.",
    };

  // 사장님에게 앱 내 알림. 실패해도 문의 접수는 성공 처리한다.
  try {
    const { data: biz } = await admin
      .from("businesses")
      .select("user_id")
      .eq("id", site.business_id)
      .maybeSingle();
    if (biz) {
      await admin.from("notifications").insert({
        user_id: biz.user_id,
        business_id: site.business_id,
        type: "site_inquiry",
        site_slug: site.slug,
        actor_name: name,
        preview: message.slice(0, 80),
      });
    }
  } catch {
    // 알림은 부가 기능 — 실패해도 문의 접수를 방해하지 않는다.
  }

  return { ok: true };
}
