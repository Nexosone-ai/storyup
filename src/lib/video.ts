import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { getPlanId, currentPeriod } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";

/**
 * 유료고객 AI 영상 — 월 무료 패킷(횟수) + 구매 크레딧. 실제 생성은 fal.ai(큐+폴링).
 * 무료는 usage_events(kind='video', charged 0), 초과는 video_credit_ledger(−1).
 * 운영 비용은 플랜 무료 횟수(Basic 8/Pro 10)로 상한. 서버 전용.
 */

export class NoVideoCreditsError extends Error {
  constructor(ko = true) {
    super(
      ko
        ? "이번 달 무료 영상을 모두 사용했어요. 영상 팩을 구매해주세요."
        : "No video credits left. Please buy a video pack.",
    );
    this.name = "NoVideoCreditsError";
  }
}
export class VideoEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoEngineError";
  }
}

export interface VideoQuota {
  planId: string;
  freeLimit: number | null; // null = 무제한(Partner)
  freeUsed: number;
  purchased: number;
  available: number | null; // null = 무제한
}

export async function getPurchasedVideoCredits(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("video_credit_ledger")
    .select("amount")
    .eq("user_id", userId);
  return (data ?? []).reduce((s, r) => s + r.amount, 0);
}

export async function getVideoQuota(userId: string): Promise<VideoQuota> {
  const planId = await getPlanId(userId);
  const freeLimit = getPlanById(planId).limits.video;
  const admin = createAdminClient();
  const { count } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "video")
    .gte("created_at", currentPeriod().startIso);
  const freeUsed = count ?? 0;
  const purchased = await getPurchasedVideoCredits(userId);
  const freeRemaining = freeLimit === null ? null : Math.max(0, freeLimit - freeUsed);
  const available = freeRemaining === null ? null : freeRemaining + purchased;
  return { planId, freeLimit, freeUsed, purchased, available };
}

export interface VideoCharge {
  refund: () => Promise<void>;
}

/** 영상 1편 차감 — 무료 잔여 우선, 없으면 구매 크레딧. 둘 다 없으면 차단. */
export async function consumeVideo(
  userId: string,
  ko = true,
): Promise<VideoCharge> {
  const admin = createAdminClient();
  const q = await getVideoQuota(userId);

  // 무료(무제한 포함) 잔여가 있으면 usage_events로 기록.
  const freeRemaining =
    q.freeLimit === null ? Infinity : Math.max(0, q.freeLimit - q.freeUsed);
  if (freeRemaining > 0) {
    const { data } = await admin
      .from("usage_events")
      .insert({ user_id: userId, kind: "video", charged: 0 })
      .select("id")
      .single();
    const id = data?.id;
    return {
      refund: async () => {
        if (id) await admin.from("usage_events").delete().eq("id", id);
      },
    };
  }

  // 구매 크레딧 차감.
  if (q.purchased > 0) {
    const { data } = await admin
      .from("video_credit_ledger")
      .insert({ user_id: userId, amount: -1, reason: "video", ref_type: "use" })
      .select("id")
      .single();
    const id = data?.id;
    return {
      refund: async () => {
        if (id) await admin.from("video_credit_ledger").delete().eq("id", id);
      },
    };
  }

  throw new NoVideoCreditsError(ko);
}

/** 영상 크레딧 지급(영상 팩 결제/관리자). */
export async function grantVideoCredits(
  userId: string,
  amount: number,
  reason: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("video_credit_ledger")
    .insert({ user_id: userId, amount, reason, ref_type: "grant" });
}

// ---------------- fal.ai 영상 엔진(큐 + 폴링) ----------------

const FAL_MODEL = process.env.FAL_VIDEO_MODEL || "fal-ai/ltx-video";

export function videoEngineConfigured(): boolean {
  return !!process.env.FAL_KEY;
}

export interface SubmitResult {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
}

/** fal 큐에 영상 생성 제출 → request_id/status_url/response_url. */
export async function submitVideo(prompt: string): Promise<SubmitResult> {
  const key = process.env.FAL_KEY;
  if (!key) throw new VideoEngineError("영상 엔진이 설정되지 않았습니다. (FAL_KEY 누락)");
  const res = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[fal-video] submit", res.status, json?.detail ?? json?.error);
    throw new VideoEngineError(
      res.status === 429 || res.status >= 500
        ? "영상 서버가 혼잡합니다. 잠시 후 다시 시도해주세요."
        : `영상 생성 요청 실패 (${res.status})`,
    );
  }
  const requestId = json.request_id as string;
  const statusUrl = (json.status_url as string) ?? "";
  const responseUrl = (json.response_url as string) ?? "";
  if (!requestId || !statusUrl || !responseUrl)
    throw new VideoEngineError("영상 작업 생성에 실패했습니다.");
  return { requestId, statusUrl, responseUrl };
}

export type VideoJobState =
  | { status: "processing" }
  | { status: "done"; videoUrl: string }
  | { status: "failed"; error: string };

/** fal 작업 상태 확인 → 완료 시 영상 URL. */
export async function pollVideo(
  statusUrl: string,
  responseUrl: string,
): Promise<VideoJobState> {
  const key = process.env.FAL_KEY;
  if (!key) return { status: "failed", error: "엔진 미설정" };
  try {
    const sres = await fetch(statusUrl, { headers: { Authorization: `Key ${key}` } });
    const sjson = await sres.json().catch(() => ({}));
    const status = sjson?.status as string | undefined;
    if (status !== "COMPLETED") {
      // IN_QUEUE / IN_PROGRESS → 아직 처리 중. (오류 상태면 failed)
      if (status === "ERROR" || status === "FAILED")
        return { status: "failed", error: "영상 생성에 실패했습니다." };
      return { status: "processing" };
    }
    const rres = await fetch(responseUrl, { headers: { Authorization: `Key ${key}` } });
    const rjson = await rres.json().catch(() => ({}));
    const url: string | undefined =
      rjson?.video?.url ?? rjson?.video_url ?? rjson?.videos?.[0]?.url;
    if (!url) return { status: "failed", error: "영상 URL을 받지 못했습니다." };
    return { status: "done", videoUrl: url };
  } catch (err) {
    console.error("[fal-video] poll", err);
    return { status: "processing" };
  }
}
