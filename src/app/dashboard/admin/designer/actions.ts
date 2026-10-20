"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { grantDesigner, revokeDesigner } from "@/lib/marketplace/designer";
import { markDesignerEarningPaid } from "@/lib/marketplace/sales";
import { parseGithubUrl } from "@/lib/marketplace/github";

export interface DesignerAdminState {
  ok?: boolean;
  error?: string;
  message?: string;
  slug?: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, admin: !!data?.is_admin };
}

async function userIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return data?.user_id ?? null;
}

function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = randomBytes(3).toString("hex");
  return base ? `${base}-${suffix}` : suffix;
}

/** 디자이너 권한 부여(이메일). */
export async function grantDesignerAction(email: string): Promise<DesignerAdminState> {
  const { user, admin } = await requireAdmin();
  if (!admin || !user) return { error: "권한이 없습니다." };
  const uid = await userIdByEmail(email);
  if (!uid) return { error: "해당 이메일의 계정을 찾을 수 없어요." };
  await grantDesigner(uid, user.id);
  revalidatePath("/dashboard/admin/designer");
  return { ok: true, message: `${email} 님에게 디자이너 권한을 부여했어요.` };
}

/** 디자이너 권한 해제. */
export async function revokeDesignerAction(userId: string): Promise<DesignerAdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  await revokeDesigner(userId);
  revalidatePath("/dashboard/admin/designer");
  return { ok: true };
}

/** 심사 — 제출된 버전을 승인/반려. */
export async function reviewTemplateVersionAction(
  versionId: string,
  decision: "approve" | "reject",
): Promise<DesignerAdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const adminc = createAdminClient();
  const next = decision === "approve" ? "approved" : "rejected";
  const { data, error } = await adminc
    .from("template_versions")
    .update({ status: next })
    .eq("id", versionId)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (error) return { error: "처리에 실패했어요." };
  if (!data) return { error: "이미 처리됐거나 심사 대상이 아니에요." };
  revalidatePath("/dashboard/admin/designer");
  return { ok: true };
}

export interface PublishInput {
  versionId: string;
  title: string;
  summary: string;
  priceKrw: number;
  commissionPct: number;
}

/**
 * 발행 + 판매 등록 — 승인된 버전을 published로 바꾸고, 결제용 상품(/pay/{slug})과
 * 리스팅을 만든다. 이미 리스팅이 있으면 가격·수수료만 갱신(상품도 갱신).
 */
export async function publishTemplateAction(
  input: PublishInput,
): Promise<DesignerAdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };

  const title = input.title.trim();
  if (!title) return { error: "판매 제목을 입력해주세요." };
  if (!Number.isInteger(input.priceKrw) || input.priceKrw < 0)
    return { error: "가격을 올바르게 입력해주세요." };
  if (
    !Number.isInteger(input.commissionPct) ||
    input.commissionPct < 0 ||
    input.commissionPct > 100
  )
    return { error: "수수료(%)는 0~100 사이로 입력해주세요." };

  const adminc = createAdminClient();
  const { data: ver } = await adminc
    .from("template_versions")
    .select("id, template_id, status")
    .eq("id", input.versionId)
    .maybeSingle();
  if (!ver) return { error: "버전을 찾을 수 없어요." };
  if (!["approved", "submitted", "published"].includes(ver.status))
    return { error: "승인 후 발행할 수 있어요." };

  const { data: tpl } = await adminc
    .from("design_templates")
    .select("id, owner_user_id")
    .eq("id", ver.template_id)
    .maybeSingle();
  if (!tpl) return { error: "템플릿을 찾을 수 없어요." };

  // 기존 리스팅(버전당 1개) 확인 — 있으면 상품/리스팅 갱신, 없으면 신규 생성.
  const { data: existing } = await adminc
    .from("template_listings")
    .select("id, product_id")
    .eq("version_id", ver.id)
    .maybeSingle();

  let productId = existing?.product_id ?? null;
  let slug: string | null = null;

  if (productId) {
    await adminc
      .from("products")
      .update({
        name: title,
        description: input.summary.trim() || null,
        price: input.priceKrw,
        active: true,
        grants_template_version: ver.id,
      })
      .eq("id", productId);
    const { data: p } = await adminc.from("products").select("slug").eq("id", productId).maybeSingle();
    slug = p?.slug ?? null;
  } else {
    for (let attempt = 0; attempt < 5; attempt++) {
      const s = makeSlug(title);
      const { data: created, error } = await adminc
        .from("products")
        .insert({
          slug: s,
          name: title,
          description: input.summary.trim() || null,
          price: input.priceKrw,
          active: true,
          grants_template_version: ver.id,
        })
        .select("id, slug")
        .maybeSingle();
      if (!error && created) {
        productId = created.id;
        slug = created.slug;
        break;
      }
      if (error && error.code !== "23505") {
        console.error("[designer] product create failed", error);
        return { error: "판매 상품 생성에 실패했어요." };
      }
    }
    if (!productId) return { error: "판매 상품 생성에 실패했어요. 다시 시도해주세요." };
  }

  // 리스팅 upsert(version_id unique).
  const { error: listErr } = await adminc.from("template_listings").upsert(
    {
      template_id: tpl.id,
      version_id: ver.id,
      designer_user_id: tpl.owner_user_id,
      product_id: productId,
      title,
      summary: input.summary.trim() || null,
      price_krw: input.priceKrw,
      commission_pct: input.commissionPct,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "version_id" },
  );
  if (listErr) {
    console.error("[designer] listing upsert failed", listErr);
    return { error: "판매 등록에 실패했어요." };
  }

  // 버전 발행 + 템플릿 활성화.
  await adminc.from("template_versions").update({ status: "published" }).eq("id", ver.id);
  await adminc.from("design_templates").update({ status: "active" }).eq("id", tpl.id);

  revalidatePath("/dashboard/admin/designer");
  return {
    ok: true,
    message: slug ? `발행했어요. 결제 링크: /pay/${slug}` : "발행했어요.",
    slug: slug ?? undefined,
  };
}

/** 판매 중지 — 리스팅 일시중지 + 상품 비활성화(기존 구매·소유권은 유지). */
export async function pauseListingAction(listingId: string): Promise<DesignerAdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const adminc = createAdminClient();
  const { data: listing } = await adminc
    .from("template_listings")
    .select("id, product_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { error: "리스팅을 찾을 수 없어요." };
  await adminc
    .from("template_listings")
    .update({ status: "paused", updated_at: new Date().toISOString() })
    .eq("id", listingId);
  if (listing.product_id)
    await adminc.from("products").update({ active: false }).eq("id", listing.product_id);
  revalidatePath("/dashboard/admin/designer");
  return { ok: true };
}

/** 정산 지급 처리. */
export async function markDesignerEarningPaidAction(
  id: string,
): Promise<DesignerAdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  await markDesignerEarningPaid(id);
  revalidatePath("/dashboard/admin/designer");
  return { ok: true };
}

// ---------------- 추천 스킬 카탈로그 ----------------

export interface CatalogInput {
  repoUrl: string;
  title: string;
  description: string;
  tag: string;
  sortOrder: number;
}

/** 추천 스킬 추가 — 공개 GitHub URL만 허용(가져오기는 파트너가 원클릭). */
export async function addSkillCatalogAction(
  input: CatalogInput,
): Promise<DesignerAdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };

  const url = input.repoUrl.trim();
  if (!parseGithubUrl(url)) return { error: "github.com 공개 저장소 URL을 입력해주세요." };
  const title = input.title.trim();
  if (!title) return { error: "제목을 입력해주세요." };

  const adminc = createAdminClient();
  const { error } = await adminc.from("skill_catalog").insert({
    repo_url: url,
    title,
    description: input.description.trim() || null,
    tag: input.tag.trim() || null,
    sort_order: Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0,
  });
  if (error) {
    console.error("[designer] catalog add failed", error);
    return { error: "추가에 실패했어요." };
  }
  revalidatePath("/dashboard/admin/designer");
  revalidatePath("/partner/designer/skills");
  return { ok: true, message: "추천 스킬을 추가했어요." };
}

/** 추천 스킬 노출/숨김 토글. */
export async function toggleSkillCatalogAction(
  id: string,
  active: boolean,
): Promise<DesignerAdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const adminc = createAdminClient();
  await adminc
    .from("skill_catalog")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/dashboard/admin/designer");
  revalidatePath("/partner/designer/skills");
  return { ok: true };
}

/** 추천 스킬 삭제. */
export async function removeSkillCatalogAction(id: string): Promise<DesignerAdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const adminc = createAdminClient();
  await adminc.from("skill_catalog").delete().eq("id", id);
  revalidatePath("/dashboard/admin/designer");
  revalidatePath("/partner/designer/skills");
  return { ok: true };
}

// ---------------- 디자인 프롬프트 프리셋(편집기 '프롬프트로 구성') ----------------

export interface DesignPromptInput {
  id?: string;
  title: string;
  tag: string;
  hint: string;
  prompt: string;
  sortOrder: number;
  active: boolean;
}

/** 프롬프트 프리셋 추가/수정(id 있으면 수정). */
export async function upsertDesignPromptAction(
  input: DesignPromptInput,
): Promise<DesignerAdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };

  const title = input.title.trim();
  const prompt = input.prompt.trim();
  if (!title) return { error: "제목을 입력해주세요." };
  if (!prompt) return { error: "프롬프트를 입력해주세요." };

  const adminc = createAdminClient();
  const row = {
    title,
    tag: input.tag.trim() || null,
    hint: input.hint.trim() || null,
    prompt,
    sort_order: Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0,
    active: input.active,
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await adminc.from("design_prompts").update(row).eq("id", input.id)
    : await adminc.from("design_prompts").insert(row);
  if (error) {
    console.error("[designer] prompt upsert failed", error);
    return { error: "저장에 실패했어요." };
  }
  revalidatePath("/dashboard/admin/designer");
  return { ok: true, message: input.id ? "수정했어요." : "프롬프트를 추가했어요." };
}

/** 노출/숨김 토글. */
export async function toggleDesignPromptAction(
  id: string,
  active: boolean,
): Promise<DesignerAdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const adminc = createAdminClient();
  await adminc
    .from("design_prompts")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/dashboard/admin/designer");
  return { ok: true };
}

/** 삭제. */
export async function removeDesignPromptAction(id: string): Promise<DesignerAdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const adminc = createAdminClient();
  await adminc.from("design_prompts").delete().eq("id", id);
  revalidatePath("/dashboard/admin/designer");
  return { ok: true };
}
