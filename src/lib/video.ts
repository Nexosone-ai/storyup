import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { getServicePrice } from "@/lib/payments/prices";

/**
 * 유료고객 AI 영상 — 생성 1편당 UP 포인트 차감(관리자 단가 service_prices 'AI_VIDEO').
 * 제출 시 선차감(spend_points)하고 video_jobs.charged에 기록 → 생성 실패 시 환급한다.
 * 실제 생성은 fal.ai(큐+폴링). 서버 전용.
 */

export const VIDEO_SERVICE = "AI_VIDEO";

export class VideoEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoEngineError";
  }
}

export interface VideoPricing {
  /** 영상 1편당 UP 단가(관리자 설정). 0 = 무료. */
  price: number;
  /** 사용자 보유 UP. */
  balance: number;
}

/** 사용자 보유 UP 잔액. */
export async function getPointsBalance(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("point_transactions")
    .select("amount")
    .eq("user_id", userId);
  return (data ?? []).reduce((s, t) => s + t.amount, 0);
}

/** 영상 생성 UP 단가 + 사용자 잔액. */
export async function getVideoPricing(userId: string): Promise<VideoPricing> {
  const [price, balance] = await Promise.all([
    getServicePrice(VIDEO_SERVICE),
    getPointsBalance(userId),
  ]);
  return { price, balance };
}

/** 생성 실패 시 선차감한 UP을 환급(REFUND 트랜잭션). amount<=0이면 아무 것도 안 함. */
export async function refundVideoPoints(
  userId: string,
  amount: number,
  reason = "AI 영상 생성 실패 — 환급",
): Promise<void> {
  if (amount <= 0) return;
  const admin = createAdminClient();
  const { error } = await admin.from("point_transactions").insert({
    user_id: userId,
    amount,
    reason,
    type: "REFUND",
    ref_type: "video_refund",
  });
  if (error) console.error("[video] refund failed", userId, error);
}

/** (레거시) 영상 크레딧 지급 — 영상 팩 결제 fulfillment 호환용. reason 유니크로 멱등. */
export async function grantVideoCredits(
  userId: string,
  amount: number,
  reason: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("video_credit_ledger")
    .insert({ user_id: userId, amount, reason, ref_type: "grant" });
  // 23505 = unique_violation → 이미 지급됨(멱등), 무시.
  if (error && error.code !== "23505") throw error;
}

// ---------------- fal.ai 영상 엔진(큐 + 폴링) ----------------

// 기본값은 현행 지원 모델이어야 함(과거 kling v1.6 standard는 fal 지원 종료).
// Wan 2.2 A14B: 상업용·prompt만으로 호출 가능·저가(~$0.1/초, 기본 ≈5초).
const FAL_MODEL =
  process.env.FAL_VIDEO_MODEL || "fal-ai/wan/v2.2-a14b/text-to-video";

export function videoEngineConfigured(): boolean {
  return !!(process.env.FAL_KEY || "").trim();
}

/**
 * FAL_KEY를 안전하게 읽는다. 앞뒤 공백은 다듬고, 중간에 공백·줄바꿈 등
 * HTTP 헤더에 못 쓰는 문자가 섞였으면 '키 값을 노출하지 않고' 차단한다.
 * (붙여넣기 중 끼어든 공백/개행이 'invalid header value'로 터지는 걸 안전한 안내로 대체.)
 */
function falKey(): string {
  const key = (process.env.FAL_KEY || "").trim();
  if (!key) throw new VideoEngineError("영상 엔진이 설정되지 않았습니다. (FAL_KEY 누락)");
  if (!/^[\x21-\x7e]+$/.test(key))
    throw new VideoEngineError(
      "영상 엔진 키 형식이 올바르지 않아요. Vercel의 FAL_KEY 값에 공백·줄바꿈이 섞이지 않았는지 확인해주세요.",
    );
  return key;
}

/** 오류 메시지에 키가 섞여 나오지 않도록 제거(키 유출 방지). */
function redactKey(msg: string, key: string): string {
  return key ? msg.split(key).join("***") : msg;
}

/** fal 도메인만 허용 — 서버가 fal 키를 임의 주소로 보내는 SSRF/키유출 방지. */
function isFalUrl(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h === "fal.run" || h === "queue.fal.run" || h.endsWith(".fal.run");
  } catch {
    return false;
  }
}

export interface SubmitResult {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
}

/** fal 큐에 영상 생성 제출 → request_id/status_url/response_url. */
export async function submitVideo(prompt: string): Promise<SubmitResult> {
  const key = falKey();
  // 네트워크/DNS/타임아웃 등 fetch 자체 실패도 실제 사유를 노출(일반 오류로 가려지지 않게).
  let res: Response;
  try {
    res = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
  } catch (err) {
    console.error("[fal-video] submit network", err);
    const raw = (err as Error)?.message ?? "네트워크 오류";
    throw new VideoEngineError(
      `영상 서버에 연결하지 못했어요 — ${redactKey(raw, key)}`,
    );
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof json?.detail === "string"
        ? json.detail
        : Array.isArray(json?.detail)
          ? JSON.stringify(json.detail).slice(0, 200)
          : (json?.error ?? "");
    console.error("[fal-video] submit", res.status, detail);
    throw new VideoEngineError(
      res.status === 429 || res.status >= 500
        ? "영상 서버가 혼잡합니다. 잠시 후 다시 시도해주세요."
        : res.status === 401 || res.status === 403
          ? `영상 엔진 인증/잔액을 확인해주세요(fal 키·크레딧).${detail ? ` — ${redactKey(detail, key)}` : ""}`
          : res.status === 404
            ? `영상 모델을 찾을 수 없어요(FAL_VIDEO_MODEL 확인: ${FAL_MODEL}).`
            : `영상 생성 요청 실패 (${res.status})${detail ? ` — ${detail}` : ""}`,
    );
  }
  const requestId = json.request_id as string;
  const statusUrl = (json.status_url as string) ?? "";
  const responseUrl = (json.response_url as string) ?? "";
  if (!requestId || !statusUrl || !responseUrl)
    throw new VideoEngineError("영상 작업 생성에 실패했습니다.");
  // SSRF 방지: fal이 돌려준 주소도 fal 도메인인지 확인 후 저장.
  if (!isFalUrl(statusUrl) || !isFalUrl(responseUrl))
    throw new VideoEngineError("영상 작업 주소가 올바르지 않습니다.");
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
  const key = (process.env.FAL_KEY || "").trim();
  // 키 미설정/형식오류(공백 등)면 영구 실패로 굳히지 않고 처리중 유지(복구 크론/다음 폴에 맡김).
  if (!key || !/^[\x21-\x7e]+$/.test(key)) return { status: "processing" };
  // SSRF 방지: fal 도메인이 아니면 키를 보내지 않는다.
  if (!isFalUrl(statusUrl) || !isFalUrl(responseUrl)) {
    console.error("[fal-video] non-fal job url blocked", statusUrl, responseUrl);
    return { status: "failed", error: "잘못된 작업 주소입니다." };
  }
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

export interface VideoJobRow {
  id: string;
  user_id: string;
  business_id: string;
  prompt: string;
  status_url: string | null;
  response_url: string | null;
  /** 제출 시 선차감한 UP(실패 시 환급 대상). */
  charged: number;
}

/**
 * 처리 중 작업을 확인해 완료/실패 처리(멱등). poll 액션·복구 크론 공용.
 * UP은 제출 시 선차감했으므로, 완료는 저장만 / 실패는 환급한다.
 * processing→done·failed 원자적 전환으로 '단 한 번만' 처리(중복 환급 방지).
 */
export async function finalizeIfComplete(
  job: VideoJobRow,
): Promise<VideoJobState> {
  const state = await pollVideo(job.status_url ?? "", job.response_url ?? "");
  const admin = createAdminClient();
  if (state.status === "processing") return state;

  if (state.status === "failed") {
    // 원자적 claim(한 번만)한 경우에만 선차감 UP 환급.
    const { data: claimed } = await admin
      .from("video_jobs")
      .update({ status: "failed", error: state.error })
      .eq("id", job.id)
      .eq("status", "processing")
      .select("id")
      .maybeSingle();
    if (claimed) await refundVideoPoints(job.user_id, job.charged);
    return state;
  }

  // 완료 — 원자적 claim(한 번만 성공)한 경우에만 저장(UP은 제출 시 차감됨).
  const { data: claimed } = await admin
    .from("video_jobs")
    .update({ status: "done", video_url: state.videoUrl })
    .eq("id", job.id)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  if (claimed) {
    await admin.from("agency_deliverables").insert({
      business_id: job.business_id,
      kind: "video",
      title: job.prompt.slice(0, 80),
      url: state.videoUrl,
      created_by: job.user_id,
    });
  }
  return state;
}
