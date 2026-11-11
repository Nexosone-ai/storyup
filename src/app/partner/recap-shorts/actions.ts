"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/queries";
import { isCurrentUserPartner } from "@/lib/partner";
import {
  consumeEntitlement,
  refundEntitlement,
  InsufficientEntitlementError,
  EntitlementError,
} from "@/lib/partner/entitlements";
import { contentToPlainText } from "@/utils/markdown";
import { generateImageResilient } from "@/lib/ai/image";
import { storeGeneratedImage } from "@/lib/ai/imageStore";
import { storeGeneratedAudio } from "@/lib/ai/audioStore";
import { synthesizeSpeech } from "@/lib/ai/tts";
import { AIGenerationError } from "@/lib/ai/provider";
import { CARD_FONTS } from "@/components/cards/cardTheme";
import {
  RECAP_SHORTS_ENABLED,
  RECAP_SHORTS_ACTION,
  RECAP_IMAGE_ACTION,
  RECAP_DEFAULT_VOICE,
  isRecapVoice,
  type RecapImageSource,
  type RecapScene,
} from "@/lib/recapShorts/config";
import { generateRecapScript, RecapScriptError } from "@/lib/recapShorts/script";
import {
  getRecapJob,
  parseScenes,
  saveRecapScenes,
  setRecapStatus,
  cardBackgroundsForPost,
  deriveStatus,
  listRecapCandidatePosts,
  type RecapCandidatePost,
} from "@/lib/recapShorts/jobs";

/** 0) 사업장의 발행 글 목록(+카드뉴스 배경 보유 여부) — 만들기 폼의 글 선택용. */
export async function listRecapPostsAction(
  businessId: string,
): Promise<{ posts: RecapCandidatePost[]; error?: string }> {
  const auth = await requireRecapPartner();
  if ("error" in auth) return { posts: [], error: auth.error };
  const business = await getBusiness(businessId);
  if (!business) return { posts: [], error: "사업장을 찾을 수 없어요." };
  const supabase = await createClient();
  return { posts: await listRecapCandidatePosts(supabase, business.id) };
}

// 요약 쇼츠 UI는 파트너 영상 허브(탭)에 있다. revalidatePath 는 search param 을 무시하므로 모든 탭이 갱신된다.
const PATH = "/partner/videos";
const BGM_RE = /^(bright|calm|energetic|none|library:\d{2})$/;
/** TTS 서버 동시성 — 장면 5~7개를 한 액션 안에서 처리(서버 액션은 클라이언트별 직렬이라 클라이언트 루프보다 빠름). */
const TTS_CONCURRENCY = 3;

async function requireRecapPartner(): Promise<
  { user: { id: string } } | { error: string }
> {
  if (!RECAP_SHORTS_ENABLED) return { error: "이용할 수 없는 기능입니다." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!(await isCurrentUserPartner())) return { error: "파트너 전용 기능입니다." };
  return { user };
}

export interface CreateRecapInput {
  businessId: string;
  blogPostId: string;
  voice?: string;
  imageSource?: RecapImageSource;
  font?: string;
  bgm?: string;
}

/**
 * 1) 잡 생성 — 패킷 선과금(RECAP_SHORTS) → 글 본문 평문화 → Claude 대본 → 잡 insert.
 * 카드뉴스 소스면 배경 이미지를 장면에 즉시 매핑(장면이 더 많으면 순환). 대본/저장 실패 시 환불.
 */
export async function createRecapJobAction(
  input: CreateRecapInput,
): Promise<{ jobId?: string; error?: string }> {
  const auth = await requireRecapPartner();
  if ("error" in auth) return { error: auth.error };
  const { user } = auth;

  const business = await getBusiness(input.businessId);
  if (!business) return { error: "사업장을 찾을 수 없어요." };

  const voice = isRecapVoice(input.voice ?? "") ? input.voice! : RECAP_DEFAULT_VOICE;
  const imageSource: RecapImageSource = input.imageSource === "ai" ? "ai" : "cardnews";
  const font = CARD_FONTS.some((f) => f.id === input.font) ? input.font! : "nanum-gothic";
  const bgm = BGM_RE.test(input.bgm ?? "") ? input.bgm! : "bright";

  // 발행 글(RLS로 파트너 고객 사업장까지 조회 가능).
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("id, title, content")
    .eq("id", input.blogPostId)
    .eq("business_id", business.id)
    .eq("status", "published")
    .maybeSingle();
  if (!post) return { error: "발행된 블로그 글을 찾을 수 없어요." };
  const postText = contentToPlainText(post.content ?? "").trim();
  if (postText.length < 80)
    return { error: "글 본문이 너무 짧아 요약 쇼츠를 만들 수 없어요." };

  // 카드뉴스 소스는 배경 이미지가 있어야 한다 — 과금 전에 검증.
  let backgrounds: string[] | null = null;
  if (imageSource === "cardnews") {
    backgrounds = await cardBackgroundsForPost(business.id, post.id);
    if (!backgrounds)
      return {
        error:
          "이 글에는 카드뉴스 배경 이미지가 없어요. 먼저 카드뉴스를 만들거나 이미지 소스를 'AI 생성'으로 선택해주세요.",
      };
  }

  // 작업권 선소비(1편당 RECAP_SHORTS 1). 없으면 판매 안내(fail-closed).
  let billing;
  try {
    billing = await consumeEntitlement(user.id, RECAP_SHORTS_ACTION, 1, {
      refBusinessId: business.id,
      reason: "recap_shorts",
    });
  } catch (err) {
    if (err instanceof InsufficientEntitlementError || err instanceof EntitlementError)
      return { error: err.message };
    console.error("[recap] entitlement consume failed", err);
    return { error: "작업권 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요." };
  }

  // 대본.
  let script;
  try {
    script = await generateRecapScript({
      businessName: business.name,
      category: String(business.category ?? ""),
      postTitle: post.title ?? "",
      postText,
    });
  } catch (err) {
    await billing.refund();
    return {
      error: err instanceof RecapScriptError ? err.message : "대본 생성에 실패했어요.",
    };
  }

  const scenes: RecapScene[] = script.scenes.map((s, i) => ({
    idx: i,
    narration: s.narration,
    caption: s.caption,
    imagePrompt: s.imagePrompt,
    imageUrl: backgrounds ? backgrounds[i % backgrounds.length] : null,
    audioUrl: null,
    durationMs: null,
    error: null,
  }));

  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("recap_shorts_jobs")
    .insert({
      user_id: user.id,
      business_id: business.id,
      blog_post_id: post.id,
      title: script.title,
      status: "script",
      voice,
      image_source: imageSource,
      font,
      bgm,
      scenes: scenes as unknown as import("@/types/database").Json,
      credits_charged: billing.consumed, // 소비한 작업권 수(RECAP_SHORTS) — 삭제 시 환불 기준
    })
    .select("id")
    .single();
  if (error || !job) {
    console.error("[recap] job insert failed", error);
    await billing.refund();
    return { error: "작업 저장에 실패했어요. 다시 시도해주세요." };
  }
  revalidatePath(PATH);
  return { jobId: job.id };
}

/**
 * 2) 내레이션 합성 — audioUrl 없는 장면만 TTS(동시성 3) → site-audio 저장 → durationMs 기록.
 * 멱등: 부분 실패는 scene.error에 남기고 done=false로 반환 → 클라이언트가 재호출/재시도.
 */
export async function synthRecapAudioAction(
  jobId: string,
): Promise<{ done: boolean; failed: number[]; error?: string }> {
  const auth = await requireRecapPartner();
  if ("error" in auth) return { done: false, failed: [], error: auth.error };
  const { user } = auth;
  const job = await getRecapJob(user.id, jobId);
  if (!job) return { done: false, failed: [], error: "작업을 찾을 수 없어요." };

  const scenes = parseScenes(job.scenes);
  const todo = scenes.filter((s) => !s.audioUrl && s.narration.trim());
  const failed: number[] = [];
  const folderBiz = job.business_id ?? user.id;

  let cursor = 0;
  const worker = async () => {
    while (cursor < todo.length) {
      const s = todo[cursor++];
      try {
        const out = await synthesizeSpeech({ text: s.narration, voice: job.voice });
        const url = await storeGeneratedAudio(folderBiz, "recap", out.wav, out.mime);
        if (!url) throw new AIGenerationError("오디오 저장에 실패했어요.");
        s.audioUrl = url;
        s.durationMs = out.durationMs;
        s.error = null;
      } catch (err) {
        s.error = err instanceof Error ? err.message : "음성 합성 실패";
        failed.push(s.idx);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(TTS_CONCURRENCY, todo.length) }, worker),
  );

  const status = deriveStatus(scenes, job.image_source);
  await saveRecapScenes(user.id, jobId, scenes, status);
  revalidatePath(PATH);
  return { done: scenes.every((s) => !!s.audioUrl), failed };
}

/**
 * 3) AI 장면 이미지 — 장면 1개씩(클라이언트 순차 루프). imageUrl 있으면 skip(멱등).
 * 장당 EXTRA_IMAGE 과금, 실패 시 환불.
 */
export async function generateRecapSceneImageAction(
  jobId: string,
  idx: number,
): Promise<{ imageUrl?: string; done?: boolean; error?: string }> {
  const auth = await requireRecapPartner();
  if ("error" in auth) return { error: auth.error };
  const { user } = auth;
  const job = await getRecapJob(user.id, jobId);
  if (!job) return { error: "작업을 찾을 수 없어요." };
  if (job.image_source !== "ai")
    return { error: "AI 이미지 소스가 아닌 작업이에요." };

  const scenes = parseScenes(job.scenes);
  const scene = scenes.find((s) => s.idx === idx);
  if (!scene) return { error: "장면을 찾을 수 없어요." };
  if (scene.imageUrl) return { imageUrl: scene.imageUrl, done: true };
  if (!scene.imagePrompt) return { error: "이 장면에는 이미지 프롬프트가 없어요." };

  let billing;
  try {
    billing = await consumeEntitlement(user.id, RECAP_IMAGE_ACTION, 1, {
      refBusinessId: job.business_id ?? null,
      refId: jobId,
      reason: "recap_scene_image",
    });
  } catch (err) {
    if (err instanceof InsufficientEntitlementError || err instanceof EntitlementError)
      return { error: err.message };
    return { error: "작업권 처리 중 문제가 발생했어요." };
  }

  try {
    const img = await generateImageResilient(scene.imagePrompt, "9:16", { premium: true });
    const url = await storeGeneratedImage(job.business_id ?? user.id, "recap", img);
    if (!url) throw new Error("store failed");
    scene.imageUrl = url;
    scene.error = null;
  } catch (err) {
    await billing.refund();
    scene.error = err instanceof Error ? err.message : "이미지 생성 실패";
    await saveRecapScenes(user.id, jobId, scenes);
    return { error: "이미지 생성에 실패했어요. 다시 시도해주세요." };
  }

  const status = deriveStatus(scenes, job.image_source);
  await saveRecapScenes(user.id, jobId, scenes, status);
  revalidatePath(PATH);
  return {
    imageUrl: scene.imageUrl ?? undefined,
    done: scenes.every((s) => !!s.imageUrl),
  };
}

/** 4) 대본·자막 수정 — 내레이션이 바뀌면 그 장면의 오디오를 무효화해 재합성하게 한다. */
export async function updateRecapSceneAction(
  jobId: string,
  idx: number,
  patch: { narration?: string; caption?: string },
): Promise<{ ok?: true; error?: string }> {
  const auth = await requireRecapPartner();
  if ("error" in auth) return { error: auth.error };
  const { user } = auth;
  const job = await getRecapJob(user.id, jobId);
  if (!job) return { error: "작업을 찾을 수 없어요." };
  const scenes = parseScenes(job.scenes);
  const scene = scenes.find((s) => s.idx === idx);
  if (!scene) return { error: "장면을 찾을 수 없어요." };

  if (typeof patch.caption === "string") scene.caption = patch.caption.trim().slice(0, 80);
  if (typeof patch.narration === "string") {
    const next = patch.narration.trim().slice(0, 400);
    if (!next) return { error: "내레이션은 비울 수 없어요." };
    if (next !== scene.narration) {
      scene.narration = next;
      scene.audioUrl = null;
      scene.durationMs = null;
      scene.error = null;
    }
  }
  const status = deriveStatus(scenes, job.image_source);
  const ok = await saveRecapScenes(user.id, jobId, scenes, status);
  if (!ok) return { error: "저장에 실패했어요." };
  revalidatePath(PATH);
  return { ok: true };
}

/** 5) 렌더 완료 기록(선택적으로 영상 URL). */
export async function finalizeRecapJobAction(
  jobId: string,
  videoUrl?: string | null,
): Promise<{ ok?: true; error?: string }> {
  const auth = await requireRecapPartner();
  if ("error" in auth) return { error: auth.error };
  const { user } = auth;
  const job = await getRecapJob(user.id, jobId);
  if (!job) return { error: "작업을 찾을 수 없어요." };
  await setRecapStatus(user.id, jobId, "ready", {
    video_url: videoUrl && /^https?:\/\//.test(videoUrl) ? videoUrl.slice(0, 600) : job.video_url,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * 삭제 — 완료된 장면(오디오)이 하나도 없으면 소비한 작업권을 돌려준다(유사영상 '전부 실패 → 환불' 규칙).
 * 이미 일부라도 합성됐으면 비용이 발생했으므로 환불하지 않는다. 원장은 삭제하지 않고 환불 행을 추가.
 */
export async function deleteRecapJobAction(
  jobId: string,
): Promise<{ ok?: true; refunded?: number; error?: string }> {
  const auth = await requireRecapPartner();
  if ("error" in auth) return { error: auth.error };
  const { user } = auth;
  const job = await getRecapJob(user.id, jobId);
  if (!job) return { error: "작업을 찾을 수 없어요." };

  const scenes = parseScenes(job.scenes);
  const anyDone = scenes.some((s) => !!s.audioUrl);
  const admin = createAdminClient();
  let refunded = 0;
  if (!anyDone && job.credits_charged > 0) {
    const ok = await refundEntitlement(user.id, RECAP_SHORTS_ACTION, job.credits_charged, {
      refBusinessId: job.business_id,
      refId: jobId,
      reason: "recap_job_deleted",
    });
    if (ok) refunded = job.credits_charged;
  }
  await admin.from("recap_shorts_jobs").delete().eq("id", jobId).eq("user_id", user.id);
  revalidatePath(PATH);
  return { ok: true, refunded };
}
