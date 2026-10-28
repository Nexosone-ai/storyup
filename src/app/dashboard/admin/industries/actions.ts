"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/points";
import { slugWithFallback } from "@/utils/slug";
import { stripHtml } from "@/utils/richtext";
import { BUSINESS_CATEGORIES, INDUSTRY_IDS } from "@/types/domain";
import type { Json } from "@/types/database";

export interface AdminIndustryInput {
  id?: string;
  slug?: string;
  nameKo: string;
  nameEn?: string;
  icon?: string;
  summaryKo?: string;
  summaryEn?: string;
  sortOrder?: number;
  status?: "draft" | "published";
  mapsCategory?: string | null;
  mapsIndustry?: string | null;
  sensitive?: boolean;
  /** 상세 콘텐츠 오버라이드(JSON 문자열). 빈 값이면 코드 기본 콘텐츠 사용. */
  contentJson?: string;
}
export interface AdminIndustryState {
  ok?: boolean;
  error?: string;
}

function clean(v: string | undefined, max: number): string {
  return stripHtml(v ?? "").trim().slice(0, max);
}

/** 업종 생성/수정(메타데이터 + 선택적 콘텐츠 오버라이드). 발행은 별도 액션. */
export async function upsertIndustryAction(
  input: AdminIndustryInput,
): Promise<AdminIndustryState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const admin = createAdminClient();

  const nameKo = clean(input.nameKo, 60);
  if (!nameKo) return { error: "업종명(한글)을 입력해주세요." };

  // content 오버라이드 — JSON 유효성만 검사(관리자 입력). 빈 값이면 null(기본 콘텐츠).
  let content: Json | null = null;
  if (input.contentJson && input.contentJson.trim()) {
    try {
      content = JSON.parse(input.contentJson) as Json;
    } catch {
      return { error: "상세 콘텐츠 JSON 형식이 올바르지 않습니다." };
    }
  }

  const mapsCategory =
    input.mapsCategory &&
    (BUSINESS_CATEGORIES as readonly string[]).includes(input.mapsCategory)
      ? input.mapsCategory
      : null;
  const mapsIndustry =
    input.mapsIndustry &&
    (INDUSTRY_IDS as readonly string[]).includes(input.mapsIndustry)
      ? input.mapsIndustry
      : null;

  const row = {
    name_ko: nameKo,
    name_en: clean(input.nameEn, 60),
    icon: clean(input.icon, 16),
    summary_ko: clean(input.summaryKo, 160),
    summary_en: clean(input.summaryEn, 160),
    sort_order: Math.max(0, Math.min(9999, Math.round(input.sortOrder ?? 100))),
    status: input.status === "published" ? ("published" as const) : ("draft" as const),
    maps_category: mapsCategory,
    maps_industry: mapsIndustry,
    sensitive: !!input.sensitive,
    content,
  };

  if (input.id) {
    const { error } = await admin
      .from("industries")
      .update(row)
      .eq("id", input.id);
    if (error) return { error: "저장에 실패했어요." };
  } else {
    // 새 업종 — slug 생성(중복 회피).
    const base = slugWithFallback(input.slug || nameKo, "industry");
    let slug = base;
    const { data: dup } = await admin
      .from("industries")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (dup) slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await admin.from("industries").insert({ ...row, slug });
    if (error) return { error: "생성에 실패했어요(slug 중복일 수 있어요)." };
  }

  revalidatePath("/dashboard/admin/industries");
  revalidatePath("/industries");
  return { ok: true };
}

/** 발행/비공개 전환(채택과 분리된 명시적 발행 단계). */
export async function setIndustryStatusAction(
  id: string,
  status: "draft" | "published",
): Promise<AdminIndustryState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("industries")
    .update({ status: status === "published" ? "published" : "draft" })
    .eq("id", id);
  if (error) return { error: "상태 변경에 실패했어요." };
  revalidatePath("/dashboard/admin/industries");
  revalidatePath("/industries");
  return { ok: true };
}

export async function deleteIndustryAction(
  id: string,
): Promise<AdminIndustryState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const admin = createAdminClient();
  const { error } = await admin.from("industries").delete().eq("id", id);
  if (error) return { error: "삭제에 실패했어요." };
  revalidatePath("/dashboard/admin/industries");
  revalidatePath("/industries");
  return { ok: true };
}
