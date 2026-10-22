import "server-only";

/**
 * provideo 음악 생성 = SUNO(설정 가능한 엔드포인트).
 * Suno는 공식 셀프서비스 API가 없어, 공식 파트너 API든 서드파티 aggregator든
 * env로 '주소·경로·키'만 바꿔 끼울 수 있게 범용으로 구현한다. Claude가 만든
 * music_prompt를 그대로 전달한다. 제출→폴링→오디오 URL.
 *
 * 필요한 env:
 *   SUNO_API_KEY          (필수) Bearer 인증 키
 *   SUNO_API_BASE         (필수) 예: https://api.example.com
 *   SUNO_GENERATE_PATH    (선택, 기본 /api/generate) 생성 요청 경로
 *   SUNO_POLL_PATH        (선택, 기본 /api/get) 상태 조회 경로(?ids=... 또는 /{id})
 *   SUNO_MODEL            (선택) 모델/버전 파라미터
 * 제공처마다 응답 형태가 달라, 오디오 URL/작업 id를 '여러 흔한 필드'에서 방어적으로 찾는다.
 */

export class MusicError extends Error {}

const AUDIO_KEYS = ["audio_url", "audioUrl", "audio", "url", "stream_audio_url"];
const ID_KEYS = ["id", "task_id", "taskId", "clip_id", "song_id"];

/** 중첩 객체/배열에서 첫 번째로 보이는 오디오 URL을 찾는다(.mp3/.wav/audio_url 등). */
function findAudioUrl(v: unknown, depth = 0): string | null {
  if (depth > 6 || v == null) return null;
  if (typeof v === "string") {
    return /^https?:\/\/\S+\.(mp3|wav|m4a|ogg)(\?|$)/i.test(v) ? v : null;
  }
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = findAudioUrl(x, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of AUDIO_KEYS) {
      const val = o[k];
      if (typeof val === "string" && /^https?:\/\//.test(val)) return val;
    }
    for (const val of Object.values(o)) {
      const r = findAudioUrl(val, depth + 1);
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
  const t = setTimeout(() => ctrl.abort(), 20_000);
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
      console.error("[provideo/music]", res.status, text.slice(0, 300));
      throw new MusicError("음악 API 호출에 실패했어요(엔드포인트·키 확인).");
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

/** 음악 프롬프트 → 오디오 URL. 제출 후 최대 ~50초 폴링. 미완료면 MusicError(재시도 안내). */
export async function generateMusic(prompt: string): Promise<{ audioUrl: string }> {
  const key = process.env.SUNO_API_KEY;
  const base = process.env.SUNO_API_BASE?.replace(/\/+$/, "");
  if (!key || !base)
    throw new MusicError("음악 엔진(SUNO)이 설정되지 않았어요(SUNO_API_KEY·SUNO_API_BASE).");
  const genPath = process.env.SUNO_GENERATE_PATH || "/api/generate";
  const pollPath = process.env.SUNO_POLL_PATH || "/api/get";
  const model = process.env.SUNO_MODEL;

  // 1) 생성 요청
  const submit = await call(`${base}${genPath}`, key, {
    method: "POST",
    body: JSON.stringify({
      prompt: prompt.slice(0, 1200),
      ...(model ? { model, mv: model } : {}),
      make_instrumental: false,
    }),
  });

  // 응답에 바로 오디오가 있으면 사용.
  const direct = findAudioUrl(submit);
  if (direct) return { audioUrl: direct };

  // 아니면 작업 id로 폴링.
  const id = findId(submit);
  if (!id) throw new MusicError("음악 작업 식별자를 받지 못했어요(응답 형식 확인).");

  const deadline = Date.now() + 50_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    // ?ids=id 와 /{id} 두 흔한 형태를 모두 시도.
    const sep = pollPath.includes("?") ? "&" : "?";
    let status: unknown;
    try {
      status = await call(`${base}${pollPath}${sep}ids=${encodeURIComponent(id)}`, key);
    } catch {
      status = await call(`${base}${pollPath}/${encodeURIComponent(id)}`, key).catch(() => null);
    }
    const audio = findAudioUrl(status);
    if (audio) return { audioUrl: audio };
  }
  throw new MusicError("음악 생성이 아직 끝나지 않았어요. 잠시 후 다시 시도해주세요.");
}
