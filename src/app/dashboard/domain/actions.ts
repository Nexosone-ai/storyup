"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";

export interface DomainActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/** 프로토콜/경로/공백 제거 후 소문자 호스트만 남긴다. */
function normalizeDomainInput(raw: string): string {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/\/.*$/, "");
  d = d.replace(/\.$/, "");
  return d;
}

// 호스트명 형식(라벨.라벨…, 최소 하나의 점) 검증.
const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || "storyup.me").toLowerCase();

/** 개인 도메인 연결 요청 — Pro 이상. 상태 pending으로 등록(관리자/자동 활성화 대기). */
export async function connectDomainAction(
  businessId: string,
  rawDomain: string,
): Promise<DomainActionState> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // 플랜 게이팅 — plan.domain === "custom" (Pro/Partner)
  if (getPlanById(await getPlanId(user.id)).domain !== "custom")
    return {
      error: ko
        ? "개인 도메인 연결은 Pro 플랜에서 사용할 수 있어요. 플랜을 업그레이드해주세요."
        : "Custom domains are available on the Pro plan. Please upgrade.",
    };

  const domain = normalizeDomainInput(rawDomain);
  if (!HOST_RE.test(domain))
    return {
      error: ko
        ? "올바른 도메인 형식이 아니에요. 예: myshop.com"
        : "Invalid domain. Example: myshop.com",
    };
  if (domain === APP_DOMAIN || domain.endsWith(`.${APP_DOMAIN}`))
    return {
      error: ko
        ? "STORYUP 도메인은 개인 도메인으로 연결할 수 없어요."
        : "You cannot connect a STORYUP domain.",
    };

  // 소유 사업장 확인
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz)
    return { error: ko ? "사업장을 찾을 수 없습니다." : "Business not found." };

  // 이미 이 사업장에 도메인이 있으면 교체 대신 안내
  const { data: existing } = await supabase
    .from("custom_domains")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (existing)
    return {
      error: ko
        ? "이미 연결된 도메인이 있어요. 기존 도메인을 해제한 뒤 다시 연결해주세요."
        : "A domain is already connected. Remove it first.",
    };

  const { error } = await supabase
    .from("custom_domains")
    .insert({ business_id: businessId, domain, status: "pending" });
  if (error) {
    // 유니크 위반 = 다른 곳에서 이미 사용 중인 도메인
    if (error.code === "23505")
      return {
        error: ko
          ? "이미 다른 곳에서 사용 중인 도메인이에요."
          : "This domain is already in use.",
      };
    return { error: ko ? "연결 요청에 실패했습니다." : "Failed to connect." };
  }

  revalidatePath("/dashboard/domain");
  return {
    ok: true,
    message: ko
      ? "도메인이 등록됐어요. 아래 DNS 설정을 완료하면 검토 후 연결됩니다."
      : "Domain registered. Complete the DNS setup below; it will be connected after review.",
  };
}

/** 개인 도메인 연결 해제. */
export async function disconnectDomainAction(
  domainId: string,
): Promise<DomainActionState> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // RLS(소유자)로 본인 도메인만 삭제된다.
  const { error } = await supabase
    .from("custom_domains")
    .delete()
    .eq("id", domainId);
  if (error)
    return { error: ko ? "해제에 실패했습니다." : "Failed to remove." };

  revalidatePath("/dashboard/domain");
  return { ok: true, message: ko ? "연결이 해제됐어요." : "Domain removed." };
}
