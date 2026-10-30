import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { slugWithFallback, randomSuffix } from "@/utils/slug";
import type { Database } from "@/types/database";

export type StorefrontRow =
  Database["public"]["Tables"]["partner_storefronts"]["Row"];

/** 공개 스토어프론트(가격 없음 — 로고·소개·연락처만). status=active만. */
export interface PublicStorefront {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  intro: string | null;
  contact: string | null;
  sellerInfo: string | null;
}

function toPublic(r: StorefrontRow): PublicStorefront {
  return {
    slug: r.slug,
    displayName: r.display_name,
    logoUrl: r.logo_url,
    intro: r.intro,
    contact: r.contact,
    sellerInfo: r.seller_info,
  };
}

/** 파트너 본인 스토어프론트(없으면 null). */
export async function getMyStorefront(
  partnerUserId: string,
): Promise<StorefrontRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_storefronts")
    .select("*")
    .eq("partner_user_id", partnerUserId)
    .maybeSingle();
  return data ?? null;
}

/** 활성 파트너 목록(고객이 도입 파트너를 고를 수 있도록). 안전필드만. */
export async function listActiveStorefronts(): Promise<PublicStorefront[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_storefronts")
    .select("*")
    .eq("status", "active")
    .order("display_name", { ascending: true });
  return (data ?? []).map(toPublic);
}

/** 공개 페이지용 — slug로 활성 스토어프론트 조회(서비스롤, 안전필드만). */
export async function getPublicStorefront(
  slug: string,
): Promise<PublicStorefront | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_storefronts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  return data ? toPublic(data) : null;
}

export interface StorefrontInput {
  displayName: string;
  slug?: string;
  logoUrl?: string | null;
  intro?: string | null;
  contact?: string | null;
  sellerInfo?: string | null;
  status?: "active" | "hidden";
}

/**
 * 파트너 스토어프론트 생성/수정 — 호출 전 isCurrentUserPartner 확인.
 * slug 중복 시 접미사로 재시도. 세션 RLS 클라이언트로 쓰기(파트너 본인 정책).
 */
export async function upsertStorefront(
  partnerUserId: string,
  input: StorefrontInput,
): Promise<{ slug?: string; error?: string }> {
  const supabase = await createClient();
  const existing = await getMyStorefront(partnerUserId);
  let slug =
    (input.slug && input.slug.trim()) ||
    existing?.slug ||
    slugWithFallback(input.displayName, "partner");

  const row = {
    partner_user_id: partnerUserId,
    slug,
    display_name: input.displayName.trim(),
    logo_url: input.logoUrl ?? null,
    intro: input.intro ?? null,
    contact: input.contact ?? null,
    seller_info: input.sellerInfo ?? null,
    status: input.status ?? existing?.status ?? "active",
    updated_at: new Date().toISOString(),
  };

  // slug 유니크 충돌 시 접미사 붙여 최대 3회 재시도.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase
      .from("partner_storefronts")
      .upsert({ ...row, slug }, { onConflict: "partner_user_id" });
    if (!error) return { slug };
    if (error.code === "23505") {
      slug = `${slugWithFallback(input.displayName, "partner")}-${randomSuffix()}`;
      continue;
    }
    console.error("[b2b2c] storefront upsert failed", error);
    return { error: "스토어 정보 저장에 실패했습니다." };
  }
  return { error: "스토어 주소(slug)가 중복됩니다. 다른 이름을 사용해주세요." };
}
