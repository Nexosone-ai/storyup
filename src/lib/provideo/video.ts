import "server-only";

/**
 * provideo 영상 생성 = Seedance 2.5(설정 가능한 엔드포인트).
 * 장면 이미지(Phase 2) + 모션 프롬프트 → image-to-video. 제공처(fal.ai/Replicate/
 * BytePlus 등)마다 주소·형식이 달라, 음악과 동일하게 env로 바꿔 끼운다.
 *
 * env:
 *   SEEDANCE_API_KEY        (필수)
 *   SEEDANCE_API_BASE       (필수) 예: https://queue.fal.run
 *   SEEDANCE_GENERATE_PATH  (선택, 기본 /) 생성 요청 경로(모델 경로 포함 가능)
 *   SEEDANCE_POLL_PATH      (선택, 기본 /) 상태 조회 경로(?ids= 또는 /{id})
 *   SEEDANCE_MODEL          (선택) 모델/버전
 */

export class VideoError extends Error {}

const VIDEO_KEYS = ["video_url", "videoUrl", "video", "url", "output", "mp4"];
const ID_KEYS = ["id", "task_id", "taskId", "request_id", "requestId", "job_id"];

function findVideoUrl(v: unknown, depth = 0): string | null {
  if (depth > 6 || v == null) return null;
  if (typeof v === "string")
    return /^https?:\/\/\S+\.(mp4|webm|mov|m4v)(\?|$)/i.test(v) ? v : null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = findVideoUrl(x, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of VIDEO_KEYS) {
      const val = o[k];
      if (typeof val === "string" && /^https?:\/\//.test(val)) {
        const r = findVideoUrl(val, depth + 1);
        if (r) return r;
      }
    }
    for (const val of Object.values(o)) {
      const r = findVideoUrl(val, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function findId(v: unknown, depth = 0): string | null {
  if (depth > 5 || v == null) return null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = findId(x, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ID_KEYS) {
      const val = o[k];
      if (typeof val === "string" && val) return val;
      if (typeof val === "number") return String(val);
    }
    for (const val of Object.values(o)) {
      const r = findId(val, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

async function call(url: string, key: string, init?: RequestInit): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[provideo/video]", res.status, text.slice(0, 300));
      throw new VideoError("영상 API 호출에 실패했어요(엔드포인트·키 확인).");
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } finally {
    clearTimeout(t);
  }
}

/**
 * 장면 이미지 → 영상 클립. 제출 후 최대 ~50초 폴링. 미완료면 VideoError(재시도).
 * quality: 480p|720p|1080p (광고 1080p·자체 720p·드래프트 480p), aspect: 9:16 등.
 */
export async function generateSceneVideo(input: {
  imageUrl: string;
  prompt: string;
  quality: string;
  aspect: string;
}): Promise<{ videoUrl: string }> {
  const key = process.env.SEEDANCE_API_KEY;
  const base = process.env.SEEDANCE_API_BASE?.replace(/\/+$/, "");
  if (!key || !base)
    throw new VideoError("영상 엔진(Seedance)이 설정되지 않았어요(SEEDANCE_API_KEY·SEEDANCE_API_BASE).");
  const genPath = process.env.SEEDANCE_GENERATE_PATH || "/";
  const pollPath = process.env.SEEDANCE_POLL_PATH || "/";
  const model = process.env.SEEDANCE_MODEL;

  const submit = await call(`${base}${genPath}`, key, {
    method: "POST",
    body: JSON.stringify({
      image_url: input.imageUrl,
      prompt: input.prompt.slice(0, 1000),
      resolution: input.quality,
      aspect_ratio: input.aspect,
      ...(model ? { model } : {}),
    }),
  });

  const direct = findVideoUrl(submit);
  if (direct) return { videoUrl: direct };

  const id = findId(submit);
  if (!id) throw new VideoError("영상 작업 식별자를 받지 못했어요(응답 형식 확인).");

  const deadline = Date.now() + 50_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const sep = pollPath.includes("?") ? "&" : "?";
    let status: unknown;
    try {
      status = await call(`${base}${pollPath}${sep}ids=${encodeURIComponent(id)}`, key);
    } catch {
      status = await call(`${base}${pollPath}/${encodeURIComponent(id)}`, key).catch(() => null);
    }
    const video = findVideoUrl(status);
    if (video) return { videoUrl: video };
  }
  throw new VideoError("영상 생성이 아직 끝나지 않았어요. 잠시 후 다시 시도해주세요.");
}
