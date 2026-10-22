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

// ---------------- Phase 2: 에셋(배경·소품) + GPT 이미지 ----------------

/** 에셋 목록 생성(Claude) — 배경(앵글별)·소품을 미리 설계해 저장. */
export async function generateAssetsAction(projectId: string): Promise<ProVideoState> {
  const ctx = await requirePartner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;
  const ko = (await getLocale()) === "ko";

  const { data: project } = await supabase
    .from("provideo_projects")
    .select("id, business_id, concept")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "프로젝트를 찾을 수 없어요." };
  const { data: scenes } = await supabase
    .from("provideo_scenes")
    .select("script")
    .eq("project_id", projectId)
    .order("idx", { ascending: true });
  const business = project.business_id ? await getBusiness(project.business_id) : null;

  const { generateAssetList } = await import("@/lib/provideo/story");
  let assets;
  try {
    assets = await generateAssetList({
      businessName: business?.name ?? "",
      category: business?.category ?? "",
      concept: project.concept,
      scenes: (scenes ?? []).map((s) => s.script ?? "").filter(Boolean),
      language: ko ? "ko" : "en",
    });
  } catch (err) {
    return { error: err instanceof StoryboardError ? err.message : "생성에 실패했어요." };
  }
  if (assets.length === 0) return { error: "만들 에셋이 없어요. 먼저 스토리보드를 생성해주세요." };

  await supabase.from("provideo_assets").delete().eq("project_id", projectId);
  const { error } = await supabase.from("provideo_assets").insert(
    assets.map((a) => ({
      project_id: projectId,
      kind: a.kind,
      label: a.label,
      prompt: a.prompt,
      status: "draft",
    })),
  );
  if (error) return { error: "에셋 저장에 실패했어요." };
  await supabase.from("provideo_projects").update({ status: "assets" }).eq("id", projectId);
  revalidatePath(`/partner/video/${projectId}`);
  return { ok: true, projectId };
}

async function renderAndStore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  prompt: string,
): Promise<{ url?: string; error?: string }> {
  const { data: project } = await supabase
    .from("provideo_projects")
    .select("business_id, aspect")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.business_id) return { error: "사업장이 없어 이미지를 저장할 수 없어요." };
  const { generateProVideoImage, ProImageError } = await import("@/lib/provideo/image");
  const { storeGeneratedImage } = await import("@/lib/ai/imageStore");
  try {
    const img = await generateProVideoImage(prompt, project.aspect);
    const url = await storeGeneratedImage(project.business_id, "provideo", img);
    if (!url) return { error: "이미지 저장에 실패했어요." };
    return { url };
  } catch (err) {
    return {
      error: err instanceof ProImageError ? err.message : "이미지 생성에 실패했어요.",
    };
  }
}

/** 장면 이미지 생성(GPT) — scene.image_prompt로 이미지 생성 후 저장. */
export async function generateSceneImageAction(sceneId: string): Promise<ProVideoState> {
  const ctx = await requirePartner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;
  const { data: scene } = await supabase
    .from("provideo_scenes")
    .select("id, project_id, image_prompt")
    .eq("id", sceneId)
    .maybeSingle();
  if (!scene?.image_prompt) return { error: "이미지 프롬프트가 없어요." };
  const r = await renderAndStore(supabase, scene.project_id, scene.image_prompt);
  if (r.error) return { error: r.error };
  await supabase
    .from("provideo_scenes")
    .update({ image_url: r.url, status: "image" })
    .eq("id", sceneId);
  revalidatePath(`/partner/video/${scene.project_id}`);
  return { ok: true };
}

/** 에셋 이미지 생성(GPT). */
export async function generateAssetImageAction(assetId: string): Promise<ProVideoState> {
  const ctx = await requirePartner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;
  const { data: asset } = await supabase
    .from("provideo_assets")
    .select("id, project_id, prompt")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset?.prompt) return { error: "프롬프트가 없어요." };
  const r = await renderAndStore(supabase, asset.project_id, asset.prompt);
  if (r.error) return { error: r.error };
  await supabase
    .from("provideo_assets")
    .update({ image_url: r.url, status: "image" })
    .eq("id", assetId);
  revalidatePath(`/partner/video/${asset.project_id}`);
  return { ok: true };
}

// ---------------- Phase 4: SUNO 음악 ----------------

/** 음악 생성(SUNO, 설정 가능한 엔드포인트) — project.music_prompt로 생성 후 URL 저장. */
export async function generateMusicAction(projectId: string): Promise<ProVideoState> {
  const ctx = await requirePartner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const { data: project } = await supabase
    .from("provideo_projects")
    .select("id, music_prompt")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "프로젝트를 찾을 수 없어요." };
  const prompt = (project.music_prompt ?? "").trim();
  if (!prompt) return { error: "음악 프롬프트가 없어요. 먼저 스토리보드를 생성해주세요." };

  const { generateMusic, MusicError } = await import("@/lib/provideo/music");
  let audioUrl: string;
  try {
    ({ audioUrl } = await generateMusic(prompt));
  } catch (err) {
    return { error: err instanceof MusicError ? err.message : "음악 생성에 실패했어요." };
  }

  await supabase
    .from("provideo_projects")
    .update({ music_url: audioUrl, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  revalidatePath(`/partner/video/${projectId}`);
  return { ok: true, projectId };
}

// ---------------- Phase 3: Seedance 영상 ----------------

/** 장면 영상 생성(Seedance) — scene.image_url + script로 image-to-video 후 저장. */
export async function generateSceneVideoAction(sceneId: string): Promise<ProVideoState> {
  const ctx = await requirePartner();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const { data: scene } = await supabase
    .from("provideo_scenes")
    .select("id, project_id, script, image_prompt, image_url")
    .eq("id", sceneId)
    .maybeSingle();
  if (!scene) return { error: "장면을 찾을 수 없어요." };
  if (!scene.image_url)
    return { error: "먼저 이 장면의 이미지를 생성해주세요(Seedance는 이미지→영상)." };

  const { data: project } = await supabase
    .from("provideo_projects")
    .select("quality, aspect")
    .eq("id", scene.project_id)
    .maybeSingle();

  const { generateSceneVideo, VideoError } = await import("@/lib/provideo/video");
  let videoUrl: string;
  try {
    ({ videoUrl } = await generateSceneVideo({
      imageUrl: scene.image_url,
      prompt: (scene.script ?? scene.image_prompt ?? "").trim(),
      quality: project?.quality ?? "720p",
      aspect: project?.aspect ?? "9:16",
    }));
  } catch (err) {
    return { error: err instanceof VideoError ? err.message : "영상 생성에 실패했어요." };
  }

  await supabase
    .from("provideo_scenes")
    .update({ video_url: videoUrl, status: "video" })
    .eq("id", sceneId);
  revalidatePath(`/partner/video/${scene.project_id}`);
  return { ok: true };
}
