"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/queries";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import {
  getVideoQuota,
  consumeVideo,
  submitVideo,
  pollVideo,
  videoEngineConfigured,
  VideoEngineError,
  NoVideoCreditsError,
} from "@/lib/video";

const MAX_CONCURRENT = 2;

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
    const { data: job } = await supabase
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

  const { data: job } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { status: "failed", error: "작업을 찾을 수 없습니다." };
  if (job.status === "done")
    return { status: "done", videoUrl: job.video_url ?? undefined };
  if (job.status === "failed")
    return { status: "failed", error: job.error ?? "실패" };

  const state = await pollVideo(job.status_url ?? "", job.response_url ?? "");
  if (state.status === "processing") return { status: "processing" };

  const admin = createAdminClient();
  if (state.status === "failed") {
    await admin
      .from("video_jobs")
      .update({ status: "failed", error: state.error })
      .eq("id", jobId);
    return { status: "failed", error: state.error };
  }

  // 완료 — 과금(완료분만), 작업 갱신, 영상 라이브러리(agency_deliverables) 저장.
  try {
    await consumeVideo(user.id);
  } catch (err) {
    if (!(err instanceof NoVideoCreditsError)) throw err;
    // 제출 시 가용했으므로 완료본은 전달(회계는 로그만).
    console.warn("[video] consume at completion found no credit", jobId);
  }
  await admin
    .from("video_jobs")
    .update({ status: "done", video_url: state.videoUrl })
    .eq("id", jobId);
  await admin.from("agency_deliverables").insert({
    business_id: job.business_id,
    kind: "video",
    title: job.prompt.slice(0, 80),
    url: state.videoUrl,
    created_by: user.id,
  });
  return { status: "done", videoUrl: state.videoUrl };
}
