"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isCurrentUserPartner } from "@/lib/partner";
import {
  submitVideo,
  pollVideo,
  videoEngineConfigured,
  VideoEngineError,
} from "@/lib/video";
import {
  parseYouTubeId,
  isHttpUrl,
  buildVariationPrompts,
  SIMILAR_VIDEO_COUNT,
} from "@/lib/similarVideo";

const ASPECTS = new Set(["9:16", "16:9", "1:1"]);
const QUALITIES = new Set(["480p", "720p", "1080p"]);

export interface CreateBatchState {
  batchId?: string;
  error?: string;
}

/**
 * 파트너 '유사 영상 10개' 생성 시작 — 원본 영상 URL + 컨셉으로 서로 다른 10개 프롬프트를
 * 만들어 fal 큐에 한꺼번에 제출한다(text-to-video, 같은 컨셉·다른 연출). 처리 중 배치가
 * 있으면 비용·남발 방지를 위해 차단. 상태는 pollSimilarBatchAction으로 폴링한다.
 */
export async function createSimilarBatchAction(
  sourceUrl: string,
  concept: string,
  aspect: string,
  quality: string,
): Promise<CreateBatchState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!(await isCurrentUserPartner())) return { error: "파트너 전용 기능입니다." };
  if (!videoEngineConfigured())
    return { error: "영상 엔진이 아직 설정되지 않았어요(FAL_KEY 필요)." };

  const url = sourceUrl.trim();
  if (!isHttpUrl(url)) return { error: "올바른 영상 URL(http/https)을 입력해주세요." };
  const asp = ASPECTS.has(aspect) ? aspect : "9:16";
  const q = QUALITIES.has(quality) ? quality : "720p";

  // 컨셉이 비었으면 유튜브 oEmbed 제목으로 보강(키 불필요). 실패하면 무시.
  let conceptText = concept.trim().slice(0, 500);
  const ytId = parseYouTubeId(url);
  if (!conceptText && ytId) {
    try {
      const r = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`,
        { cache: "no-store" },
      );
      if (r.ok) {
        const j = await r.json();
        if (typeof j?.title === "string") conceptText = j.title.slice(0, 500);
      }
    } catch {
      /* oEmbed 실패 — 컨셉 직접 입력 유도 */
    }
  }
  if (!conceptText)
    return { error: "원본 영상의 컨셉(주제·분위기)을 한 줄 적어주세요." };

  // 한 번에 하나만 — 처리 중 배치가 있으면 차단.
  const admin = createAdminClient();
  const { count: active } = await admin
    .from("similar_video_batches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "processing");
  if ((active ?? 0) > 0)
    return { error: "처리 중인 생성이 있어요. 완료된 뒤 다시 시도해주세요." };

  const prompts = buildVariationPrompts(conceptText, asp, SIMILAR_VIDEO_COUNT);

  const { data: batch, error: bErr } = await admin
    .from("similar_video_batches")
    .insert({
      user_id: user.id,
      source_url: url,
      concept: conceptText,
      aspect: asp,
      quality: q,
      count: prompts.length,
      status: "processing",
    })
    .select("id")
    .single();
  if (bErr || !batch) return { error: "생성 준비에 실패했어요." };

  // 10개 동시 제출 — 일부 실패해도 나머지는 진행(개별 상태로 표시).
  const rows = await Promise.all(
    prompts.map(async (p) => {
      try {
        const sub = await submitVideo(p.prompt, undefined, {
          aspect_ratio: asp,
          resolution: q,
        });
        return {
          batch_id: batch.id,
          user_id: user.id,
          idx: p.idx,
          prompt: p.prompt,
          status: "processing" as const,
          request_id: sub.requestId,
          status_url: sub.statusUrl,
          response_url: sub.responseUrl,
        };
      } catch (err) {
        const msg = err instanceof VideoEngineError ? err.message : "제출 실패";
        return {
          batch_id: batch.id,
          user_id: user.id,
          idx: p.idx,
          prompt: p.prompt,
          status: "failed" as const,
          error: msg,
        };
      }
    }),
  );
  await admin.from("similar_video_jobs").insert(rows);

  // 전부 제출 실패 → 배치도 실패 처리(엔진/잔액 문제 안내).
  if (rows.every((r) => r.status === "failed")) {
    await admin
      .from("similar_video_batches")
      .update({ status: "failed" })
      .eq("id", batch.id);
    return { error: "영상 생성 요청이 모두 실패했어요(엔진·잔액을 확인해주세요)." };
  }
  return { batchId: batch.id };
}

export interface JobView {
  idx: number;
  status: string;
  videoUrl?: string;
  error?: string;
}
export interface BatchPollState {
  status: string;
  jobs: JobView[];
  error?: string;
}

/** 배치 상태 폴링 — 처리 중 작업만 fal 확인 후 완료/실패를 원자적으로 반영(멱등). */
export async function pollSimilarBatchAction(
  batchId: string,
): Promise<BatchPollState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "failed", jobs: [], error: "로그인이 필요합니다." };

  // RLS로 본인 배치만 조회됨.
  const { data: batch } = await supabase
    .from("similar_video_batches")
    .select("id, status")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch)
    return { status: "failed", jobs: [], error: "작업을 찾을 수 없습니다." };

  const { data: jobs } = await supabase
    .from("similar_video_jobs")
    .select("id, idx, status, video_url, error, status_url, response_url")
    .eq("batch_id", batchId)
    .order("idx");
  const list = jobs ?? [];

  const admin = createAdminClient();
  await Promise.all(
    list.map(async (j) => {
      if (j.status !== "processing") return;
      const state = await pollVideo(j.status_url ?? "", j.response_url ?? "");
      if (state.status === "processing") return;
      if (state.status === "done") {
        await admin
          .from("similar_video_jobs")
          .update({ status: "done", video_url: state.videoUrl })
          .eq("id", j.id)
          .eq("status", "processing");
        j.status = "done";
        j.video_url = state.videoUrl;
      } else {
        await admin
          .from("similar_video_jobs")
          .update({ status: "failed", error: state.error })
          .eq("id", j.id)
          .eq("status", "processing");
        j.status = "failed";
        j.error = state.error;
      }
    }),
  );

  // 모든 작업이 끝났으면 배치 상태 확정(하나라도 성공=done, 전부 실패=failed).
  let batchStatus = batch.status;
  const allTerminal = list.every(
    (j) => j.status === "done" || j.status === "failed",
  );
  if (allTerminal && batch.status === "processing") {
    batchStatus = list.some((j) => j.status === "done") ? "done" : "failed";
    await admin
      .from("similar_video_batches")
      .update({ status: batchStatus })
      .eq("id", batchId)
      .eq("status", "processing");
  }

  return {
    status: batchStatus,
    jobs: list.map((j) => ({
      idx: j.idx,
      status: j.status,
      videoUrl: j.video_url ?? undefined,
      error: j.error ?? undefined,
    })),
  };
}
