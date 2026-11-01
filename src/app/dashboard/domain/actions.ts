"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import {
  vercelDomainsConfigured,
  addDomainToProject,
  getDomainStatus,
  removeDomainFromProject,
} from "@/lib/vercel";

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

  const { data: inserted, error } = await supabase
    .from("custom_domains")
    .insert({ business_id: businessId, domain, status: "pending" })
    .select("id")
    .single();
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

  // Vercel 자동 등록 — env 가 설정돼 있으면 배포 프로젝트에 도메인을 붙이고,
  // DNS 가 이미 올바르면 즉시 활성화한다(검토 대기 없이). 미설정이면 기존 수동 흐름.
  let message = ko
    ? "도메인이 등록됐어요. 아래 DNS 설정을 완료하면 검토 후 연결됩니다."
    : "Domain registered. Complete the DNS setup below; it will be connected after review.";

  if (vercelDomainsConfigured()) {
    const add = await addDomainToProject(domain);
    if (add.error === "in_use") {
      // 다른 Vercel 프로젝트/계정이 선점 중 — 등록 롤백하고 안내.
      await supabase.from("custom_domains").delete().eq("id", inserted.id);
      return {
        error: ko
          ? "이 도메인이 다른 프로젝트에서 사용 중이라 연결할 수 없어요. 고객센터로 문의해주세요."
          : "This domain is already used by another project. Please contact support.",
      };
    }
    if (add.ok) {
      const status = await getDomainStatus(domain);
      if (status?.attached && status.verified && !status.misconfigured) {
        await supabase
          .from("custom_domains")
          .update({ status: "active", verified_at: new Date().toISOString() })
          .eq("id", inserted.id);
        message = ko
          ? "도메인이 연결되고 활성화됐어요. HTTPS 인증서가 자동 발급됩니다."
          : "Domain connected and activated. An HTTPS certificate is issued automatically.";
      } else {
        message = ko
          ? "도메인을 등록했어요. 아래 DNS 설정을 완료하면 자동으로 활성화됩니다. (설정 후 '상태 확인'을 눌러주세요.)"
          : "Domain registered. Complete the DNS below and it activates automatically. (Press 'Check status' after setup.)";
      }
    }
  }

  revalidatePath("/dashboard/domain");
  return { ok: true, message };
}

/**
 * 개인 도메인 상태 확인/새로고침 — Vercel 검증 상태를 다시 읽어 DNS 전파가 끝났으면
 * pending → active 로 전환한다. 소유자가 DNS 설정 후 누른다. (env 미설정이면 수동 안내.)
 */
export async function refreshDomainStatusAction(
  domainId: string,
): Promise<DomainActionState> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // RLS(소유자)로 본인 도메인만 조회된다.
  const { data: row } = await supabase
    .from("custom_domains")
    .select("id, domain, status")
    .eq("id", domainId)
    .maybeSingle();
  if (!row)
    return { error: ko ? "도메인을 찾을 수 없습니다." : "Domain not found." };
  if (row.status === "active")
    return { ok: true, message: ko ? "이미 활성화돼 있어요." : "Already active." };

  if (!vercelDomainsConfigured())
    return {
      ok: true,
      message: ko
        ? "DNS 설정이 완료되면 관리자 검토 후 활성화됩니다."
        : "It will be activated after review once DNS is set.",
    };

  // 아직 프로젝트에 안 붙어 있을 수 있으니(수동 등록분) 한 번 더 붙여 본다(멱등).
  await addDomainToProject(row.domain);
  const status = await getDomainStatus(row.domain);
  if (status?.attached && status.verified && !status.misconfigured) {
    await supabase
      .from("custom_domains")
      .update({ status: "active", verified_at: new Date().toISOString() })
      .eq("id", row.id);
    revalidatePath("/dashboard/domain");
    return {
      ok: true,
      message: ko
        ? "활성화됐어요! HTTPS 인증서가 자동 발급됩니다."
        : "Activated! An HTTPS certificate is issued automatically.",
    };
  }

  return {
    ok: true,
    message: ko
      ? "아직 DNS 전파 전이에요. 레코드(A @ → 76.76.21.21)를 확인하고 몇 분 뒤 다시 눌러주세요."
      : "DNS hasn't propagated yet. Check the record (A @ → 76.76.21.21) and try again shortly.",
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

  // 삭제 전 도메인명을 확보(Vercel 프로젝트에서도 떼어내기 위함). RLS로 본인 것만 보인다.
  const { data: row } = await supabase
    .from("custom_domains")
    .select("domain")
    .eq("id", domainId)
    .maybeSingle();

  // RLS(소유자)로 본인 도메인만 삭제된다.
  const { error } = await supabase
    .from("custom_domains")
    .delete()
    .eq("id", domainId);
  if (error)
    return { error: ko ? "해제에 실패했습니다." : "Failed to remove." };

  // Vercel 프로젝트에서도 제거(env 설정 시). 실패해도 DB 해제는 유효하다.
  if (row?.domain) await removeDomainFromProject(row.domain);

  revalidatePath("/dashboard/domain");
  return { ok: true, message: ko ? "연결이 해제됐어요." : "Domain removed." };
}
