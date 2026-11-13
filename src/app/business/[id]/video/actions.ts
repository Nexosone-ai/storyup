"use server";

import { revalidatePath } from "next/cache";
import { upsellSentence } from "@/lib/upsell";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/queries";
import { getUserPlan } from "@/lib/subscription";

import {
  submitVideo,
  finalizeIfComplete,
  videoEngineConfigured,
  VideoEngineError,
  VIDEO_SERVICE,
} from "@/lib/video";
import { chargeAiUsageUnits, InsufficientPointsError } from "@/lib/ai/billing";
import { videoLengthById } from "@/lib/videoLength";
import { getLocale } from "@/lib/i18n";
import { generateImageResilient } from "@/lib/ai/image";
import { buildCharacterPrompt } from "@/lib/ai/image/prompt";
import { storeGeneratedImage } from "@/lib/ai/imageStore";

const MAX_CONCURRENT = 2;
const VIDEO_BUCKET = "site-images"; // 공개 버킷(원본 제공) — '이어서 만들기' 프레임 등.
/** 영상 전용 공개 버킷 — 쇼츠·편집본. site-images 는 10MB 제한이라 영상은 따로 둔다(200MB). */
const VIDEOS_BUCKET = "site-videos";
// 프로젝트 전체 업로드 한도(기본 50MB)를 넘는 버킷 한도는 생성이 거부된다 — 50MB 로 요청하고,
// 그래도 거부되면 한도 없이(=프로젝트 전역 한도) 만든다. 18초 쇼츠·편집본은 보통 수 MB.
const VIDEOS_BUCKET_LIMIT = "50MB";
/** site-videos 를 쓸 수 없을 때의 폴백 — 기존 공개 이미지 버킷(10MB). */
const FALLBACK_VIDEO_BUCKET = VIDEO_BUCKET;
const UPLOAD_BUCKETS = new Set([VIDEOS_BUCKET, FALLBACK_VIDEO_BUCKET]);
/** 내 영상 종류 — 'video' AI 영상·편집본, 'shorts' 카드뉴스 쇼츠. */
export type UserVideoKind = "video" | "shorts";

/**
 * 영상 버킷 멱등 생성(공개). 있으면 true. 한도 요청이 거부되면 한도 없이 재시도한다.
 * 실패 원인은 로그로 남긴다(조용히 삼키면 '업로드 준비 실패'만 보여 원인 추적이 어렵다).
 */
async function ensureVideosBucket(
  admin: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (buckets?.some((b) => b.name === VIDEOS_BUCKET)) return true;
    const first = await admin.storage.createBucket(VIDEOS_BUCKET, {
      public: true,
      fileSizeLimit: VIDEOS_BUCKET_LIMIT,
    });
    if (!first.error) return true;
    console.error("[video] create site-videos (50MB) failed", first.error.message);
    const second = await admin.storage.createBucket(VIDEOS_BUCKET, { public: true });
    if (!second.error) return true;
    console.error("[video] create site-videos (no limit) failed", second.error.message);
    // 동시 요청이 먼저 만든 경우 — 다시 확인.
    const { data: again } = await admin.storage.listBuckets();
    return !!again?.some((b) => b.name === VIDEOS_BUCKET);
  } catch (e) {
    console.error("[video] ensure site-videos failed", e);
    return false;
  }
}

export interface CharacterState {
  url?: string;
  error?: string;
}

/**
 * 영상 전 단계 — AI 캐릭터 그리기. 설명을 받아 인물/마스코트 포트레이트를 생성·저장하고
 * 공개 URL을 돌려준다. 이 URL을 영상 생성 시 넘기면 그 인물이 영상에 등장한다(image-to-video).
 * 이미지 생성은 무료(IMAGE_GENERATION)지만 유료 플랜에서만 노출한다.
 */
export async function generateCharacterAction(
  businessId: string,
  description: string,
): Promise<CharacterState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const business = await getBusiness(businessId);
  if (!business) return { error: "권한이 없습니다." };

  const text = description.trim().slice(0, 300);
  if (!text) return { error: "캐릭터 설명을 입력해주세요." };

  const plan = await getUserPlan(user.id);
  if (plan.limits.video === 0)
    return { error: `AI 영상은 이 플랜에 포함되어 있지 않아요. ${upsellSentence(true)}` };

  const ko = (await getLocale()) === "ko";
  try {
    const prompt = buildCharacterPrompt(text, { language: ko ? "ko" : "en" });
    // 영상이 9:16(쇼츠)·세로 중심이라 캐릭터도 세로 포트레이트로 생성.
    const img = await generateImageResilient(prompt, "9:16");
    const url = await storeGeneratedImage(businessId, "characters", img);
    if (!url) return { error: "캐릭터 이미지를 저장하지 못했어요. 다시 시도해주세요." };
    return { url };
  } catch (err) {
    console.error("[video] character gen failed", err);
    return { error: "캐릭터 생성에 실패했어요. 설명을 바꿔 다시 시도해주세요." };
  }
}

export interface SubmitState {
  jobId?: string;
  error?: string;
}

/**
 * AI 영상 생성 제출 — 유료 게이트 + UP 선차감 후 fal 큐에 제출(실패 시 환급).
 * characterUrl(캐릭터 이미지)이 있으면 그 인물을 피사체로 하는 image-to-video로 생성.
 */
export async function submitVideoAction(
  businessId: string,
  prompt: string,
  characterUrl?: string,
  lengthId?: string,
): Promise<SubmitState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const business = await getBusiness(businessId);
  if (!business) return { error: "권한이 없습니다." };

  const text = prompt.trim().slice(0, 1000);
  if (!text) return { error: "영상 내용을 입력해주세요." };

  // 영상 길이 — 길수록 UP를 배수로 더 차감(관리자 단가 × multiplier).
  const length = videoLengthById(lengthId);

  const plan = await getUserPlan(user.id);
  if (plan.limits.video === 0)
    return { error: `AI 영상은 이 플랜에 포함되어 있지 않아요. ${upsellSentence(true)}` };
  if (!videoEngineConfigured())
    return { error: "영상 엔진이 아직 설정되지 않았어요(관리자 설정 필요)." };

  // 동시 처리 제한(제출 남발 방지).
  const admin = createAdminClient();
  const { count: processing } = await admin
    .from("video_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "processing");
  if ((processing ?? 0) >= MAX_CONCURRENT)
    return { error: "처리 중인 영상이 있어요. 잠시 후 다시 시도해주세요." };

  // UP 선차감 — 길이 배수 적용. 잔액 부족이면 생성하지 않고 안내(차감 없음).
  let billing;
  try {
    billing = await chargeAiUsageUnits(
      user.id,
      VIDEO_SERVICE,
      `AI 영상 생성 (${length.seconds}초)`,
      length.multiplier,
    );
  } catch (err) {
    if (err instanceof InsufficientPointsError) return { error: err.message };
    console.error("[video] charge failed", err);
    return { error: "과금 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요." };
  }

  // 캐릭터 URL은 우리 공개 스토리지(site-images)만 허용 — 임의 외부 URL 주입 방지.
  const publicBase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const charUrl =
    characterUrl &&
    publicBase &&
    characterUrl.startsWith(`${publicBase}/storage/v1/object/public/site-images/`)
      ? characterUrl
      : undefined;

  try {
    const sub = await submitVideo(text, charUrl, { duration: length.seconds });
    // video_jobs는 서비스롤만 쓰기(사용자가 status_url 등 변조 못 하게) — admin으로 기록.
    const { data: job, error: insErr } = await admin
      .from("video_jobs")
      .insert({
        user_id: user.id,
        business_id: businessId,
        prompt: text,
        status: "processing",
        request_id: sub.requestId,
        status_url: sub.statusUrl,
        response_url: sub.responseUrl,
        charged: billing.charged,
      })
      .select("id")
      .single();
    if (insErr || !job) throw new Error("작업 기록에 실패했어요.");
    return { jobId: job.id };
  } catch (err) {
    // 제출/기록 실패 → 선차감 UP 환급.
    await billing.refund();
    if (err instanceof VideoEngineError) return { error: err.message };
    return { error: "영상 생성 요청에 실패했어요." };
  }
}

export interface PollState {
  status: "processing" | "done" | "failed";
  videoUrl?: string;
  error?: string;
}

/** 작업 상태 폴링 — 완료 시 라이브러리 저장, 실패 시 선차감 UP 환급(멱등). */
export async function pollVideoAction(jobId: string): Promise<PollState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "failed", error: "로그인이 필요합니다." };

  // RLS로 본인 사업장 작업만 조회됨.
  const { data: job } = await supabase
    .from("video_jobs")
    .select(
      "id, user_id, business_id, prompt, status, video_url, error, status_url, response_url, charged",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { status: "failed", error: "작업을 찾을 수 없습니다." };
  if (job.status === "done")
    return { status: "done", videoUrl: job.video_url ?? undefined };
  if (job.status === "failed")
    return { status: "failed", error: job.error ?? "실패" };

  // 완료/실패 판정·저장·환급은 멱등 공용 함수(원자적 claim)로 단 한 번만.
  const state = await finalizeIfComplete({
    id: job.id,
    user_id: job.user_id,
    business_id: job.business_id,
    prompt: job.prompt,
    status_url: job.status_url,
    response_url: job.response_url,
    charged: job.charged ?? 0,
  });
  if (state.status === "done") return { status: "done", videoUrl: state.videoUrl };
  if (state.status === "failed") return { status: "failed", error: state.error };
  return { status: "processing" };
}

// ---------------- 편집본 저장(내 영상에 추가) ----------------

export interface UploadTicketState {
  path?: string;
  token?: string;
  /** 업로드할 버킷(클라이언트가 uploadToSignedUrl 에 그대로 사용). */
  bucket?: string;
  error?: string;
}

/**
 * 내 영상(편집본·카드뉴스 쇼츠) 업로드용 서명 URL 발급 — 영상 바이트는 서버(Vercel 본문 한도)를
 * 거치지 않고 브라우저가 Storage(site-videos, 공개)에 직접 올린다. 소유자만.
 * kind 'video' → edited-videos/, 'shorts' → shorts/ 하위.
 */
export async function createEditedVideoUploadUrl(
  businessId: string,
  ext: string,
  kind: UserVideoKind = "video",
): Promise<UploadTicketState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const business = await getBusiness(businessId);
  if (!business) return { error: "권한이 없습니다." };

  const safeExt = /^(mp4|webm)$/i.test(ext) ? ext.toLowerCase() : "mp4";
  const admin = createAdminClient();
  const folder = kind === "shorts" ? "shorts" : "edited-videos";
  const path = `${businessId}/${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${safeExt}`;
  // 1순위 site-videos(50MB). 버킷을 못 만들거나 서명이 실패하면 기존 공개 이미지 버킷(10MB)으로.
  const buckets = (await ensureVideosBucket(admin))
    ? [VIDEOS_BUCKET, FALLBACK_VIDEO_BUCKET]
    : [FALLBACK_VIDEO_BUCKET];
  for (const bucket of buckets) {
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUploadUrl(path);
    if (!error && data) return { path: data.path, token: data.token, bucket };
    console.error("[video] signed upload url failed", bucket, error?.message);
  }
  return { error: "업로드 준비에 실패했습니다. 잠시 후 다시 시도해주세요." };
}

/**
 * '이어서 만들기' — 기존 영상의 마지막 장면(프레임)을 다음 영상의 시작 이미지로 올린다.
 * 브라우저가 same-origin 프록시로 프레임을 추출해 이 서명 URL로 공개 버킷(site-images)의
 * frames/ 하위에 올리면, 그 공개 URL을 submitVideoAction의 characterUrl로 넘겨
 * image-to-video로 '이어지는' 클립을 생성한다. (characterUrl 검증 경로와 동일한 버킷)
 */
export async function createVideoFrameUploadUrl(
  businessId: string,
): Promise<UploadTicketState & { publicUrl?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const business = await getBusiness(businessId);
  if (!business) return { error: "권한이 없습니다." };
  const plan = await getUserPlan(user.id);
  if (plan.limits.video === 0)
    return { error: `AI 영상은 이 플랜에 포함되어 있지 않아요. ${upsellSentence(true)}` };

  const admin = createAdminClient();
  const path = `${businessId}/frames/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.jpg`;
  const { data, error } = await admin.storage
    .from(VIDEO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "이어서 만들기 준비에 실패했어요." };
  const {
    data: { publicUrl },
  } = admin.storage.from(VIDEO_BUCKET).getPublicUrl(path);
  return { path: data.path, token: data.token, publicUrl };
}

export interface RegisterVideoState {
  ok?: boolean;
  url?: string;
  error?: string;
}

/**
 * 업로드된 영상(편집본·쇼츠)을 '내 영상'(agency_deliverables)에 등록 — 기본 공개(is_public,
 * 0114) 라 사용자의 공개 사이트 '영상'에 바로 보인다.
 */
export async function registerEditedVideo(
  businessId: string,
  path: string,
  title: string,
  kind: UserVideoKind = "video",
  /** 업로드한 버킷(티켓의 bucket). 허용 목록 밖이면 거부. */
  bucket: string = VIDEOS_BUCKET,
): Promise<RegisterVideoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const business = await getBusiness(businessId);
  if (!business) return { error: "권한이 없습니다." };

  // 경로 변조 방지 — 반드시 이 사업장의 edited-videos/ 또는 shorts/ 하위여야 한다.
  const folder = kind === "shorts" ? "shorts" : "edited-videos";
  if (!path.startsWith(`${businessId}/${folder}/`))
    return { error: "잘못된 경로입니다." };

  if (!UPLOAD_BUCKETS.has(bucket)) return { error: "잘못된 저장소입니다." };
  const admin = createAdminClient();
  const {
    data: { publicUrl },
  } = admin.storage.from(bucket).getPublicUrl(path);

  const { error } = await supabase.from("agency_deliverables").insert({
    business_id: businessId,
    kind,
    title: title.slice(0, 80) || (kind === "shorts" ? "쇼츠" : "편집 영상"),
    url: publicUrl,
    created_by: user.id,
  });
  if (error) return { error: "저장에 실패했습니다(권한 확인)." };

  revalidatePath(`/business/${businessId}/video`);
  // 콘텐츠 스튜디오(쇼츠·편집 단계)에서도 저장하므로 함께 갱신.
  revalidatePath(`/business/${businessId}/marketing`);
  return { ok: true, url: publicUrl };
}

// ---------------- 내 영상 관리(공개 여부·삭제) ----------------

export interface VideoManageState {
  ok?: boolean;
  error?: string;
}

/** 내 영상의 공개 사이트 게시 여부 변경(소유자 RLS). 0114 미적용이면 컬럼 오류 → 안내. */
export async function setVideoPublicAction(
  businessId: string,
  deliverableId: string,
  isPublic: boolean,
): Promise<VideoManageState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { data, error } = await supabase
    .from("agency_deliverables")
    .update({ is_public: isPublic })
    .eq("id", deliverableId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();
  if (error) return { error: "변경에 실패했습니다. 잠시 후 다시 시도해주세요." };
  if (!data) return { error: "영상을 찾을 수 없습니다(권한 확인)." };
  revalidatePath(`/business/${businessId}/marketing`);
  return { ok: true };
}

/** 내 영상 삭제(소유자 RLS) — 목록·공개 사이트에서 모두 사라진다. 스토리지 파일은 보존. */
export async function deleteVideoAction(
  businessId: string,
  deliverableId: string,
): Promise<VideoManageState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { data, error } = await supabase
    .from("agency_deliverables")
    .delete()
    .eq("id", deliverableId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();
  if (error) return { error: "삭제에 실패했습니다." };
  if (!data) return { error: "영상을 찾을 수 없습니다(권한 확인)." };
  revalidatePath(`/business/${businessId}/marketing`);
  return { ok: true };
}
