"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { isCurrentUserPartner } from "@/lib/partner";
import { PROVIDEO_ENABLED } from "@/lib/provideo/config";
import { generateStoryboard, StoryboardError } from "@/lib/provideo/story";

export interface ProVideoState {
  ok?: boolean;
  error?: string;
  projectId?: string;
}

async function requirePartner() {
  if (!PROVIDEO_ENABLED) return { error: "준비 중인 기능이에요." as const };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." as const };
  if (!(await isCurrentUserPartner()))
    return { error: "파트너 전용 기능이에요." as const };
  return { supabase, user };
}

/** 새 전문 영상 프로젝트 생성. */
export async function createProVideoProject(input: {
  businessId: string;
  concept: string;
  aspect: string;
  quality: string;
}): Promise<ProVideoState> {
  const ctx = await requirePartner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const concept = input.concept.trim();
  if (!concept) return { error: "영상 컨셉/브리프를 입력해주세요." };
  // RLS로 접근 가능한 사업장만.
  const business = await getBusiness(input.businessId);
  if (!business) return { error: "사업장을 찾을 수 없어요." };

  const aspect = (
    ["9:16", "16:9", "1:1"].includes(input.aspect) ? input.aspect : "9:16"
  ) as "9:16" | "16:9" | "1:1";
  const quality = (
    ["480p", "720p", "1080p"].includes(input.quality) ? input.quality : "720p"
  ) as "480p" | "720p" | "1080p";

  const { data, error } = await supabase
    .from("provideo_projects")
    .insert({
      owner_user_id: user.id,
      business_id: input.businessId,
      title: "",
      concept,
      aspect,
      quality,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) return { error: "프로젝트 생성에 실패했어요." };

  revalidatePath("/partner/video");
  return { ok: true, projectId: data.id };
}

/** 스토리보드 생성 — Claude가 장면·이미지 프롬프트·음악 프롬프트 생성 후 저장. */
export async function generateStoryboardAction(
  projectId: string,
): Promise<ProVideoState> {
  const ctx = await requirePartner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;
  const ko = (await getLocale()) === "ko";

  const { data: project } = await supabase
    .from("provideo_projects")
    .select("id, business_id, concept, aspect")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "프로젝트를 찾을 수 없어요." };
  const business = project.business_id ? await getBusiness(project.business_id) : null;

  let board;
  try {
    board = await generateStoryboard({
      businessName: business?.name ?? "",
      category: business?.category ?? "",
      concept: project.concept,
      aspect: project.aspect,
      language: ko ? "ko" : "en",
    });
  } catch (err) {
    return { error: err instanceof StoryboardError ? err.message : "생성에 실패했어요." };
  }

  // 기존 장면 교체(재생성 대비) → 새 장면 저장.
  await supabase.from("provideo_scenes").delete().eq("project_id", projectId);
  const rows = board.scenes.map((s, i) => ({
    project_id: projectId,
    idx: i,
    script: s.script,
    image_prompt: s.imagePrompt,
    status: "draft",
  }));
  const { error: insErr } = await supabase.from("provideo_scenes").insert(rows);
  if (insErr) return { error: "장면 저장에 실패했어요." };

  await supabase
    .from("provideo_projects")
    .update({
      title: board.title,
      music_prompt: board.musicPrompt,
      status: "storyboard",
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  revalidatePath(`/partner/video/${projectId}`);
  return { ok: true, projectId };
}

/** 장면 편집(스크립트·이미지 프롬프트 수정). */
export async function updateSceneAction(
  sceneId: string,
  patch: { script?: string; imagePrompt?: string },
): Promise<ProVideoState> {
  const ctx = await requirePartner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;
  const upd: { script?: string; image_prompt?: string } = {};
  if (patch.script !== undefined) upd.script = patch.script.slice(0, 600);
  if (patch.imagePrompt !== undefined) upd.image_prompt = patch.imagePrompt.slice(0, 800);
  if (Object.keys(upd).length === 0) return { ok: true };
  const { error } = await supabase.from("provideo_scenes").update(upd).eq("id", sceneId);
  if (error) return { error: "저장에 실패했어요." };
  return { ok: true };
}

/** 프로젝트 삭제. */
export async function deleteProVideoProject(projectId: string): Promise<ProVideoState> {
  const ctx = await requirePartner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;
  const { error } = await supabase.from("provideo_projects").delete().eq("id", projectId);
  if (error) return { error: "삭제에 실패했어요." };
  revalidatePath("/partner/video");
  return { ok: true };
}
