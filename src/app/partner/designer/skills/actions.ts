"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MARKETPLACE_ENABLED } from "@/lib/marketplace/config";
import { isCurrentUserDesigner } from "@/lib/marketplace/designer";
import { analyzeGithubSkill, GithubImportError } from "@/lib/marketplace/github";

export interface SkillImportState {
  ok?: boolean;
  error?: string;
  skillId?: string;
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

/**
 * 공개 GitHub 저장소에서 Skill을 가져와(분석만) 보관함에 기록.
 * 실행(D단계)과 분리 — 여기선 메타데이터·라이선스·지원수준만 저장한다.
 */
export async function importGithubSkillAction(
  rawUrl: string,
): Promise<SkillImportState> {
  const ctx = await requireDesigner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const url = rawUrl.trim();
  if (!url) return { error: "GitHub 저장소 URL을 입력해주세요." };

  let analysis;
  try {
    analysis = await analyzeGithubSkill(url);
  } catch (err) {
    if (err instanceof GithubImportError) return { error: err.message };
    console.error("[skills] import failed", err);
    return { error: "가져오기 중 문제가 발생했어요. 잠시 후 다시 시도해주세요." };
  }

  // 같은 소유자 + 같은 commit + 같은 경로는 중복 저장하지 않음(멱등).
  const { data: existing } = await supabase
    .from("skill_sources")
    .select("id")
    .eq("owner_user_id", user.id)
    .eq("commit_sha", analysis.commitSha)
    .eq("skill_path", analysis.skillPath)
    .maybeSingle();
  if (existing) {
    revalidatePath("/partner/designer/skills");
    return { ok: true, skillId: existing.id };
  }

  const { data: row, error } = await supabase
    .from("skill_sources")
    .insert({
      owner_user_id: user.id,
      repo: analysis.repo,
      ref: analysis.ref,
      commit_sha: analysis.commitSha,
      skill_path: analysis.skillPath,
      skill_name: analysis.skillName,
      description: analysis.description,
      license: analysis.license,
      compatibility: analysis.compatibility,
      skill_type: analysis.skillType,
      support_level: analysis.supportLevel,
      support_reason: analysis.supportReason,
      files: analysis.files as unknown as Record<string, unknown>[],
      manifest: {
        allowedTools: analysis.allowedTools,
        bodyExcerpt: analysis.bodyExcerpt,
      },
      status: "imported",
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error("[skills] insert failed", error);
    return { error: "보관함 저장에 실패했어요." };
  }

  revalidatePath("/partner/designer/skills");
  return { ok: true, skillId: row.id };
}

/** 보관함에서 Skill 기록 삭제(본인 것만, RLS). */
export async function removeSkillSourceAction(
  id: string,
): Promise<SkillImportState> {
  const ctx = await requireDesigner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const { error } = await supabase.from("skill_sources").delete().eq("id", id);
  if (error) return { error: "삭제에 실패했어요." };

  revalidatePath("/partner/designer/skills");
  return { ok: true };
}
