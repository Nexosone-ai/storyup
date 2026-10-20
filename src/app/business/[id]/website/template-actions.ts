"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusiness, getWebsite } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import {
  toHomepageTemplate,
  applyHomepageTemplate,
} from "@/lib/website/homepageTemplate";
import { normalizeSiteSections, normalizeSitePages } from "@/lib/website/sections";
import type { WebsiteContent } from "@/types/domain";

export interface TemplateActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export interface HomepageTemplateRow {
  id: string;
  title: string;
  description: string | null;
}

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** 현재 사업장 홈페이지 디자인을 재사용/판매용 템플릿으로 저장(판매자 데이터 제거). */
export async function saveHomepageTemplateAction(
  businessId: string,
  title: string,
): Promise<TemplateActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await me();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // RLS로 본인 사업장만 접근.
  const web = await getWebsite(businessId);
  if (!web) return { error: ko ? "먼저 홈페이지를 만들어주세요." : "Create a website first." };

  const template = toHomepageTemplate(web.content as unknown as WebsiteContent);
  const { error } = await supabase.from("homepage_templates").insert({
    owner_user_id: user.id,
    title: title.trim() || (ko ? "내 홈페이지 디자인" : "My homepage design"),
    content: template as unknown as Record<string, unknown>,
  });
  if (error) {
    console.error("[homepage-template] save failed", error);
    return { error: ko ? "저장에 실패했어요." : "Save failed." };
  }
  return { ok: true, message: ko ? "디자인 템플릿으로 저장했어요." : "Saved as a design template." };
}

/** 내 홈페이지 템플릿 목록(공개된 것 포함, RLS). */
export async function listHomepageTemplates(): Promise<HomepageTemplateRow[]> {
  const { supabase, user } = await me();
  if (!user) return [];
  const { data } = await supabase
    .from("homepage_templates")
    .select("id, title, description")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((t) => ({ id: t.id, title: t.title, description: t.description }));
}

/** 템플릿을 현재 사업장에 '초안'으로 설치 — 바인딩이 구매자 블로그로 연결된다. */
export async function installHomepageTemplateAction(
  businessId: string,
  templateId: string,
): Promise<TemplateActionState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await me();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const business = await getBusiness(businessId);
  if (!business) return { error: ko ? "권한이 없습니다." : "No permission." };

  // RLS: 공개(is_listed)이거나 본인 소유 템플릿만 조회됨.
  const { data: tpl } = await supabase
    .from("homepage_templates")
    .select("content")
    .eq("id", templateId)
    .maybeSingle();
  if (!tpl) return { error: ko ? "템플릿을 찾을 수 없어요." : "Template not found." };

  const applied = applyHomepageTemplate(
    tpl.content as unknown as WebsiteContent,
    business.name,
  );
  // 안전 정규화(깨진 구조 방지).
  applied.sections = normalizeSiteSections(applied.sections);
  applied.pages = normalizeSitePages(applied.pages);

  // 설치는 항상 초안. 기존 사이트 있으면 교체(업서트).
  const { error } = await supabase.from("websites").upsert(
    {
      business_id: businessId,
      slug: business.slug,
      content: applied,
      status: "draft",
    },
    { onConflict: "business_id" },
  );
  if (error) {
    console.error("[homepage-template] install failed", error);
    return { error: ko ? "설치에 실패했어요." : "Install failed." };
  }

  revalidatePath(`/business/${businessId}/website`);
  return {
    ok: true,
    message: ko
      ? "디자인을 초안으로 설치했어요. 블로그 글은 내 사업장 글로 자동 연결됩니다. 확인 후 발행하세요."
      : "Installed as a draft. Blog connects to your posts. Review and publish.",
  };
}
