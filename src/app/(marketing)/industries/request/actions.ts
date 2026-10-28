"use server";

import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { stripHtml } from "@/utils/richtext";
import { assertPublicUrl } from "@/lib/ai/agent/sources";

export interface IndustryRequestInput {
  name: string;
  description: string;
  needs?: string;
  refUrl?: string;
}
export interface IndustryRequestState {
  ok?: boolean;
  error?: string;
}

const MAX_PENDING = 5; // 처리 전(received·reviewing) 요청 상한.

/** 업종 추가 요청 접수 — 로그인 필요. 입력 세정·검증, 중복/남용 방지. */
export async function submitIndustryRequestAction(
  input: IndustryRequestInput,
): Promise<IndustryRequestState> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // 세정(HTML 제거) + 길이 제한.
  const name = stripHtml(input.name ?? "").trim().slice(0, 60);
  const description = stripHtml(input.description ?? "").trim().slice(0, 1000);
  const needs = stripHtml(input.needs ?? "").trim().slice(0, 500);
  const refRaw = (input.refUrl ?? "").trim().slice(0, 300);

  if (name.length < 1)
    return { error: ko ? "요청 업종명을 입력해주세요." : "Industry name is required." };
  if (description.length < 5)
    return {
      error: ko ? "어떤 사업인지 조금 더 적어주세요." : "Please describe the business.",
    };

  // 참고 URL은 저장만 — 서버가 방문하지 않는다. 형식·내부주소만 검증.
  let refUrl: string | null = null;
  if (refRaw) {
    try {
      refUrl = assertPublicUrl(refRaw).toString();
    } catch {
      return {
        error: ko
          ? "참고 사이트 주소가 올바르지 않아요(http/https 공개 주소만)."
          : "Invalid reference URL.",
      };
    }
  }

  // 남용 방지 — 처리 전 요청 개수 상한.
  const { count } = await supabase
    .from("industry_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["received", "reviewing"]);
  if ((count ?? 0) >= MAX_PENDING)
    return {
      error: ko
        ? "처리 중인 요청이 많아요. 기존 요청이 처리된 뒤 다시 요청해주세요."
        : "Too many pending requests.",
    };

  const { error } = await supabase.from("industry_requests").insert({
    user_id: user.id,
    name,
    description,
    needs: needs || null,
    ref_url: refUrl,
  });
  if (error) {
    // 중복(같은 사용자·동일 업종명 처리 전) — 부분 유니크 인덱스 위반.
    if (error.code === "23505")
      return {
        ok: true, // 이미 접수된 것과 동일 — 중복 생성만 막고 성공으로 안내.
      };
    console.error("[industry-request] insert failed", error.message);
    return { error: ko ? "접수에 실패했어요. 잠시 후 다시 시도해주세요." : "Failed." };
  }
  return { ok: true };
}
