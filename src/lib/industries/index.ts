import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { industryContent, type IndustryContent } from "./content";
import {
  type IndustrySummary,
  industryName,
  industrySummaryText,
} from "./labels";

export type { IndustryContent } from "./content";
export { channelLabel } from "./content";
export { industryName, industrySummaryText };
export type { IndustrySummary } from "./labels";

export type IndustryRow = Database["public"]["Tables"]["industries"]["Row"];

function toSummary(r: IndustryRow): IndustrySummary {
  return {
    id: r.id,
    slug: r.slug,
    nameKo: r.name_ko,
    nameEn: r.name_en || r.name_ko,
    icon: r.icon,
    summaryKo: r.summary_ko,
    summaryEn: r.summary_en || r.summary_ko,
    sensitive: r.sensitive,
  };
}

/** 공개된 업종 목록(정렬순). 상위 분류만(하위 분류는 카드에 강제하지 않음). */
export async function listPublishedIndustries(): Promise<IndustrySummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("industries")
    .select("*")
    .eq("status", "published")
    .is("parent_id", null)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(toSummary);
}

export interface IndustryDetail {
  row: IndustryRow;
  summary: IndustrySummary;
  content: IndustryContent | null;
}

/** 공개된 업종 상세(코드 기본 콘텐츠 + DB 오버라이드). 없거나 비공개면 null. */
export async function getPublishedIndustry(
  slug: string,
): Promise<IndustryDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("industries")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  return {
    row: data,
    summary: toSummary(data),
    // DB에 관리자 오버라이드가 있으면 우선, 없으면 코드 기본 콘텐츠.
    content: (data.content as IndustryContent | null) ?? industryContent(slug),
  };
}

/** 사이트맵용 — 공개 업종 slug + 최종 수정시각. */
export async function listPublishedIndustrySlugs(): Promise<
  { slug: string; updatedAt: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("industries")
    .select("slug, updated_at")
    .eq("status", "published")
    .is("parent_id", null);
  return (data ?? []).map((r) => ({ slug: r.slug, updatedAt: r.updated_at }));
}

/** 온보딩 기본값 매핑(이 업종으로 시작하기). 공개 업종만. */
export async function getIndustryStartDefaults(
  slug: string,
): Promise<{ category: string | null; industry: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("industries")
    .select("maps_category, maps_industry, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || data.status !== "published") return null;
  return { category: data.maps_category, industry: data.maps_industry };
}

// ---------------- 관리자용(서비스롤) ----------------

/** 관리자: 모든 업종(초안 포함) 조회. 호출 전 반드시 isCurrentUserAdmin() 확인. */
export async function listAllIndustries(): Promise<IndustryRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("industries")
    .select("*")
    .order("sort_order", { ascending: true });
  return data ?? [];
}
