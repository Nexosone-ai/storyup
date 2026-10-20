"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MARKETPLACE_ENABLED, DESIGN_AI_SERVICE } from "@/lib/marketplace/config";
import { isCurrentUserDesigner } from "@/lib/marketplace/designer";
import { SAMPLE_SKILLS, SAMPLE_SKILL_LIST } from "@/lib/marketplace/samples";
import { instantiateSkill } from "@/lib/marketplace/skill";
import { validatePageSchema } from "@/lib/marketplace/validate";
import { validateDocument } from "@/lib/marketplace/validateDocument";
import type { PageSchema } from "@/lib/marketplace/pageSchema";
import type { DesignDocument } from "@/lib/marketplace/document";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import { chargeAiUsage, InsufficientPointsError } from "@/lib/ai/billing";
import { getLocale } from "@/lib/i18n";

export interface StudioState {
  ok?: boolean;
  error?: string;
  templateId?: string;
  errors?: string[];
}

async function requireDesigner() {
  if (!MARKETPLACE_ENABLED) return { error: "준비 중인 기능이에요." as const };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." as const };
  if (!(await isCurrentUserDesigner()))
    return { error: "디자이너 권한이 필요해요(관리자 승인)." as const };
  return { supabase, user };
}

/** 샘플 Skill에서 새 템플릿(초안 v1) 생성. */
export async function createTemplateFromSample(
  sampleKey: string,
): Promise<StudioState> {
  const ctx = await requireDesigner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const pkg = SAMPLE_SKILLS[sampleKey];
  if (!pkg) return { error: "샘플을 찾을 수 없어요." };
  const inst = instantiateSkill(pkg);
  if (!inst.ok || !inst.schema)
    return { error: "샘플 검증에 실패했어요.", errors: inst.errors };

  const label = SAMPLE_SKILL_LIST.find((s) => s.key === sampleKey)?.label ?? pkg.manifest.key;
  const { data: tpl, error: tplErr } = await supabase
    .from("design_templates")
    .insert({ owner_user_id: user.id, title: label })
    .select("id")
    .single();
  if (tplErr || !tpl) return { error: "템플릿 생성에 실패했어요." };

  const { error: verErr } = await supabase.from("template_versions").insert({
    template_id: tpl.id,
    version: 1,
    page_schema: inst.schema as unknown as Record<string, unknown>,
    tokens: inst.schema.tokens as unknown as Record<string, unknown>,
    status: "draft",
  });
  if (verErr) return { error: "버전 생성에 실패했어요." };

  revalidatePath("/partner/designer");
  return { ok: true, templateId: tpl.id };
}

/** 초안 버전의 Page Schema 저장(검증 통과분만). */
export async function saveTemplateVersion(
  versionId: string,
  schema: PageSchema,
): Promise<StudioState> {
  const ctx = await requireDesigner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  // RLS로 소유자 버전만 조회됨.
  const { data: v } = await supabase
    .from("template_versions")
    .select("id, status")
    .eq("id", versionId)
    .maybeSingle();
  if (!v) return { error: "버전을 찾을 수 없어요." };
  if (v.status !== "draft")
    return { error: "심사 중이거나 확정된 버전은 수정할 수 없어요. 새 버전으로 수정하세요." };

  const res = validatePageSchema(schema);
  if (!res.ok || !res.schema)
    return { error: "스키마 검증에 실패했어요.", errors: res.errors };

  const { error } = await supabase
    .from("template_versions")
    .update({
      page_schema: res.schema as unknown as Record<string, unknown>,
      tokens: res.schema.tokens as unknown as Record<string, unknown>,
    })
    .eq("id", versionId)
    .eq("status", "draft");
  if (error) return { error: "저장에 실패했어요." };

  return { ok: true };
}

export interface AiEditState {
  ok?: boolean;
  error?: string;
  schema?: PageSchema;
}

/**
 * AI 디자인 수정 — 현재 스키마를 자연어 요청대로 수정해 '제안'을 돌려준다(저장 안 함).
 * UP 선차감(DESIGN_AI_EDIT) 후 AI 호출, 결과가 검증 실패/오류면 환급. 적용은 클라이언트가.
 */
export async function aiEditSchemaAction(
  instruction: string,
  currentSchema: PageSchema,
): Promise<AiEditState> {
  const ctx = await requireDesigner();
  if ("error" in ctx) return { error: ctx.error };
  const { user } = ctx;

  const text = instruction.trim().slice(0, 500);
  if (!text) return { error: "수정 요청을 입력해주세요." };

  // 입력 스키마가 유효해야 수정 가능.
  const base = validatePageSchema(currentSchema);
  if (!base.ok || !base.schema) return { error: "현재 디자인을 읽지 못했어요." };

  const ko = (await getLocale()) === "ko";

  // UP 선차감 — 잔액 부족이면 호출하지 않음.
  let billing;
  try {
    billing = await chargeAiUsage(user.id, DESIGN_AI_SERVICE, "AI 디자인 수정");
  } catch (err) {
    if (err instanceof InsufficientPointsError) return { error: err.message };
    return { error: "과금 처리 중 문제가 발생했어요." };
  }

  try {
    const raw = await getAIProvider().editDesignSchema({
      schema: base.schema,
      instruction: text,
      language: ko ? "ko" : "en",
    });
    const res = validatePageSchema(raw);
    if (!res.ok || !res.schema) {
      await billing.refund();
      return { error: "AI 수정 결과가 올바르지 않아 적용하지 못했어요. 다시 시도해주세요." };
    }
    return { ok: true, schema: res.schema };
  } catch (err) {
    await billing.refund();
    return {
      error:
        err instanceof AIGenerationError ? err.message : "AI 수정 중 문제가 발생했어요.",
    };
  }
}

/** V2 문서(전문 편집 엔진) 저장 — 초안만, 검증 통과분만. */
export async function saveTemplateDocument(
  versionId: string,
  document: DesignDocument,
): Promise<StudioState> {
  const ctx = await requireDesigner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const { data: v } = await supabase
    .from("template_versions")
    .select("id, status")
    .eq("id", versionId)
    .maybeSingle();
  if (!v) return { error: "버전을 찾을 수 없어요." };
  if (v.status !== "draft")
    return { error: "심사 중이거나 확정된 버전은 수정할 수 없어요." };

  const res = validateDocument(document);
  if (!res.ok || !res.doc)
    return { error: "문서 검증에 실패했어요.", errors: res.errors };

  const { error } = await supabase
    .from("template_versions")
    .update({ document: res.doc as unknown as Record<string, unknown> })
    .eq("id", versionId)
    .eq("status", "draft");
  if (error) return { error: "저장에 실패했어요." };
  return { ok: true };
}

/** 심사 요청 — 초안을 submitted로(원자적). */
export async function submitTemplateVersion(versionId: string): Promise<StudioState> {
  const ctx = await requireDesigner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const { data: claimed } = await supabase
    .from("template_versions")
    .update({ status: "submitted" })
    .eq("id", versionId)
    .eq("status", "draft")
    .select("id, template_id")
    .maybeSingle();
  if (!claimed) return { error: "이미 심사 요청됐거나 수정할 수 없는 상태예요." };

  revalidatePath(`/partner/designer/templates/${claimed.template_id}/edit`);
  revalidatePath("/partner/designer");
  return { ok: true };
}
