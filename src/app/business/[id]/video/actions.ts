"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/queries";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import {
  getVideoQuota,
  submitVideo,
  finalizeIfComplete,
  videoEngineConfigured,
  VideoEngineError,
} from "@/lib/video";

const MAX_CONCURRENT = 2;
const VIDEO_BUCKET = "site-images"; // 공개 버킷(원본 제공) — 편집본은 edited-videos/ 하위.

export interface SubmitState {
  jobId?: string;
  error?: string;
}

/** AI 영상 생성 제출 — 유료 게이트 + 쿼터 확인 후 fal 큐에 제출(과금은 완료 시). */
export async function submitVideoAction(
  businessId: string,
  prompt: string,
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

  const plan = getPlanById(await getPlanId(user.id));
  if (plan.limits.video === 0)
    return { error: "AI 영상은 유료 플랜(Basic/Pro)에서 사용할 수 있어요." };
  if (!videoEngineConfigured())
    return { error: "영상 엔진이 아직 설정되지 않았어요(관리자 설정 필요)." };

  // 쿼터: 처리 중 작업까지 포함해 가용분을 넘지 않도록(제출 남발 방지).
  const q = await getVideoQuota(user.id);
  const admin = createAdminClient();
  const { count: processing } = await admin
    .from("video_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "processing");
  const proc = processing ?? 0;
  if (proc >= MAX_CONCURRENT)
    return { error: "처리 중인 영상이 있어요. 잠시 후 다시 시도해주세요." };
  if (q.available !== null && q.available - proc <= 0)
    return { error: "이번 달 무료 영상을 모두 사용했어요. 영상 팩을 구매해주세요." };

  try {
    const sub = await submitVideo(text);
    // video_jobs는 서비스롤만 쓰기(사용자가 status_url 등 변조 못 하게) — admin으로 기록.
    const { data: job } = await admin
      .from("video_jobs")
      .insert({
        user_id: user.id,
        business_id: businessId,
        prompt: text,
        status: "processing",
        request_id: sub.requestId,
        status_url: sub.statusUrl,
        response_url: sub.responseUrl,
      })
      .select("id")
      .single();
    return { jobId: job?.id };
  } catch (err) {
    if (err instanceof VideoEngineError) return { error: err.message };
    return { error: "영상 생성 요청에 실패했어요." };
  }
}

export interface PollState {
  status: "processing" | "done" | "failed";
  videoUrl?: string;
  error?: string;
}

/** 작업 상태 폴링 — 완료 시 과금(완료분만)·영상 라이브러리 저장. */
export async function pollVideoAction(jobId: string): Promise<PollState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "failed", error: "로그인이 필요합니다." };

  // RLS로 본인 사업장 작업만 조회됨.
  const { data: job } = await supabase
    .from("video_jobs")
    .select("id, user_id, business_id, prompt, status, video_url, error, status_url, response_url")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { status: "failed", error: "작업을 찾을 수 없습니다." };
  if (job.status === "done")
    return { status: "done", videoUrl: job.video_url ?? undefined };
  if (job.status === "failed")
    return { status: "failed", error: job.error ?? "실패" };

  // 완료/실패 판정·과금·저장은 멱등 공용 함수(원자적 claim)로 단 한 번만.
  const state = await finalizeIfComplete({
    id: job.id,
    user_id: job.user_id,
    business_id: job.business_id,
    prompt: job.prompt,
    status_url: job.status_url,
    response_url: job.response_url,
  });
  if (state.status === "done") return { status: "done", videoUrl: state.videoUrl };
  if (state.status === "failed") return { status: "failed", error: state.error };
  return { status: "processing" };
}

// ---------------- 편집본 저장(내 영상에 추가) ----------------

export interface UploadTicketState {
  path?: string;
  token?: string;
  error?: string;
}

/**
 * 편집본 업로드용 서명 URL 발급 — 영상 바이트는 서버(Vercel 본문 한도)를 거치지 않고
 * 브라우저가 Storage에 직접 올린다. 소유자만, 공개 버킷의 edited-videos/ 하위.
 */
export async function createEditedVideoUploadUrl(
  businessId: string,
  ext: string,
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
  const path = `${businessId}/edited-videos/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${safeExt}`;
  const { data, error } = await admin.storage
    .from(VIDEO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "업로드 준비에 실패했습니다." };
  return { path: data.path, token: data.token };
}

export interface RegisterVideoState {
  ok?: boolean;
  url?: string;
  error?: string;
}

/** 업로드된 편집본을 '내 영상'(agency_deliverables)에 등록. */
export async function registerEditedVideo(
  businessId: string,
  path: string,
  title: string,
): Promise<RegisterVideoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const business = await getBusiness(businessId);
  if (!business) return { error: "권한이 없습니다." };

  // 경로 변조 방지 — 반드시 이 사업장의 edited-videos/ 하위여야 한다.
  if (!path.startsWith(`${businessId}/edited-videos/`))
    return { error: "잘못된 경로입니다." };

  const admin = createAdminClient();
  const {
    data: { publicUrl },
  } = admin.storage.from(VIDEO_BUCKET).getPublicUrl(path);

  const { error } = await supabase.from("agency_deliverables").insert({
    business_id: businessId,
    kind: "video",
    title: title.slice(0, 80) || "편집 영상",
    url: publicUrl,
    created_by: user.id,
  });
  if (error) return { error: "저장에 실패했습니다(권한 확인)." };

  revalidatePath(`/business/${businessId}/video`);
  return { ok: true, url: publicUrl };
}
