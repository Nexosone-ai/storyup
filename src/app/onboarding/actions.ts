"use server";

import { createClient } from "@/lib/supabase/server";
import { slugWithFallback, randomSuffix } from "@/utils/slug";
import {
  BUSINESS_CATEGORIES,
  BRAND_TONES,
  INDUSTRY_IDS,
  WRITER_KINDS,
} from "@/types/domain";
import type {
  BusinessInterviewInput,
  WriterKind,
  WebsiteContent,
  SiteSection,
} from "@/types/domain";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { getLocale } from "@/lib/i18n";
import { WRITER_PRESETS } from "@/lib/website/writerPresets";

/**
 * 작가(Artist) 사이트 초기 콘텐츠 — minimal 레이아웃 + 하위 유형 프리셋 섹션.
 * 기본 비즈니스 블록(소개/제공/강점/갤러리 등)은 숨기고 작가 섹션+연락처만 노출한다.
 */
function buildWriterContent(
  name: string,
  kind: WriterKind,
  ko: boolean,
): WebsiteContent {
  const preset = WRITER_PRESETS[kind];
  const built = preset.build(ko);
  const heroSec = built.find(
    (s): s is Extract<SiteSection, { type: "hero" }> => s.type === "hero",
  );
  const rest = built.filter((s) => s.type !== "hero");
  return {
    template: preset.template,
    language: ko ? "ko" : "en",
    style: { palette: preset.palette, font: preset.font },
    hero: {
      businessName: name,
      headline: heroSec?.title ?? name,
      shortDescription: heroSec?.subtitle ?? "",
      ctaLabel: heroSec?.ctaLabel ?? (ko ? "연락하기" : "Get in touch"),
    },
    story: { title: "", body: "" },
    offers: { title: "", items: [] },
    whyChooseUs: { title: "", items: [] },
    contact: { phone: "", email: "", address: "", instagram: "", website: "" },
    sections: rest,
    hiddenSections: [
      "banner",
      "story",
      "offers",
      "whyChooseUs",
      "gallery",
      "blog",
      "cards",
      "map",
    ],
  };
}

export interface CreateBusinessResult {
  businessId?: string;
  error?: string;
}

export async function createBusinessAction(
  input: BusinessInterviewInput,
): Promise<CreateBusinessResult> {
  const name = input.name?.trim();
  if (!name) return { error: "사업 이름을 입력해주세요." };
  if (!BUSINESS_CATEGORIES.includes(input.category))
    return { error: "업종을 선택해주세요." };
  if (!input.founder_story?.trim())
    return { error: "사업을 시작한 이야기를 들려주세요." };
  if (!BRAND_TONES.includes(input.tone))
    return { error: "브랜드 톤을 선택해주세요." };
  // 업종은 선택 사항 — 값이 있으면 유효성만 검사한다.
  if (input.industry && !INDUSTRY_IDS.includes(input.industry))
    return { error: "올바른 업종을 선택해주세요." };
  // 작가 카테고리는 하위 유형(음악/미술/소설/기타) 필수.
  const isArtist = input.category === "Artist";
  const writerKind: WriterKind | null =
    isArtist && input.writerKind && WRITER_KINDS.includes(input.writerKind)
      ? input.writerKind
      : isArtist
        ? "etc"
        : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 직원 계정은 비즈니스를 생성할 수 없다(소유자만). 0044 account_owner_id.
  const { data: ownerData } = await supabase.rpc("account_owner_id", {
    p_user: user.id,
  });
  if (typeof ownerData === "string" && ownerData && ownerData !== user.id)
    return {
      error:
        "직원 계정은 새 비즈니스를 만들 수 없어요. 계정 소유자에게 요청해주세요.",
    };

  // 플랜별 사업장 개수 제한 (Free 1 · Basic 1 · Pro 5 · Partner 협의=무제한).
  const plan = getPlanById(await getPlanId(user.id));
  if (plan.maxBusinesses !== null) {
    const { count } = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= plan.maxBusinesses) {
      return {
        error:
          plan.maxBusinesses === 1
            ? `현재 ${plan.name.ko} 플랜에서는 사업장을 1개만 만들 수 있어요. 더 추가하려면 상위 플랜으로 업그레이드해주세요.`
            : `현재 ${plan.name.ko} 플랜의 사업장 한도(${plan.maxBusinesses}개)에 도달했어요. 더 추가하려면 상위 플랜으로 업그레이드해주세요.`,
      };
    }
  }

  // Ensure a unique slug.
  let slug = slugWithFallback(name);
  const { data: existing } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) slug = `${slug}-${randomSuffix()}`;

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      user_id: user.id,
      name,
      category: input.category,
      industry: input.industry || null,
      founder_story: input.founder_story.trim(),
      target_customer: input.target_customer?.trim() || null,
      strengths: input.strengths?.trim() || null,
      tone: input.tone,
      slug,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "비즈니스 생성에 실패했습니다." };

  // 작가 사이트는 하위 유형 프리셋으로 초기 웹사이트(minimal)를 바로 시드한다.
  if (writerKind) {
    const ko = (await getLocale()) === "ko";
    const content = buildWriterContent(name, writerKind, ko);
    await supabase.from("websites").upsert(
      {
        business_id: data.id,
        slug,
        content,
        status: "draft",
      },
      { onConflict: "business_id" },
    );
    // 시드 실패해도 비즈니스 생성은 성공으로 본다(이후 생성기에서 복구 가능).
  }

  return { businessId: data.id };
}
