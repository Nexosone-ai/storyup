import { AIGenerationError } from "./provider";

/**
 * 음성 전사(STT) — Gemini 멀티모달 사용. Server-only.
 * Claude Messages API는 오디오 입력을 받지 않으므로 전사만 Gemini가 담당하고,
 * 이후 글 구성/다듬기는 기존 Claude 파이프라인이 이어받는다.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.GEMINI_STT_MODEL || "gemini-3.6-flash";

/** 요청 본문(base64 포함) 한도를 고려한 오디오 최대 크기. */
export const VOICE_MAX_BYTES = 20 * 1024 * 1024;

/** 브라우저 녹음(webm/mp4)과 흔한 녹음 앱 포맷(m4a/mp3/wav)을 커버한다. */
const SUPPORTED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
]);

const MIME_ALIASES: Record<string, string> = {
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/mp3": "audio/mpeg",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
};

/** `audio/webm;codecs=opus` 같은 변형을 표준 MIME으로 정규화. 미지원이면 null. */
export function normalizeAudioMime(mime: string | null | undefined): string | null {
  if (!mime) return null;
  const base = mime.split(";")[0].trim().toLowerCase();
  const normalized = MIME_ALIASES[base] ?? base;
  return SUPPORTED_AUDIO_MIMES.has(normalized) ? normalized : null;
}

interface GeminiTextPart {
  text?: string;
}

/** 오디오를 들리는 그대로 전사해 순수 텍스트로 반환한다. */
export async function transcribeAudio(
  audio: Buffer,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIGenerationError(
      "음성 변환이 설정되지 않았습니다. (GEMINI_API_KEY 누락)",
    );
  }

  let json: {
    candidates?: Array<{ content?: { parts?: GeminiTextPart[] } }>;
    error?: { message?: string };
  };
  try {
    const res = await fetch(`${ENDPOINT}/${DEFAULT_MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `다음 오디오에서 말한 내용을 들리는 그대로 전사하세요.
- 말한 언어 그대로 작성 (번역 금지)
- "음", "어" 같은 추임새는 제외하고, 문장 부호를 넣어 자연스러운 문장으로
- 전사문 외에 설명·인사 등 다른 말은 절대 쓰지 마세요
- 말소리가 전혀 없으면 빈 문자열만 반환하세요`,
              },
              {
                inlineData: {
                  mimeType,
                  data: audio.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    });
    json = await res.json();
    if (!res.ok) {
      console.error("[stt]", res.status, json?.error?.message);
      throw new AIGenerationError(
        res.status === 429 || res.status >= 500
          ? "음성 변환 서버가 혼잡합니다. 잠시 후 다시 시도해주세요."
          : `음성 변환에 실패했습니다. (${res.status})`,
      );
    }
  } catch (err) {
    if (err instanceof AIGenerationError) throw err;
    throw new AIGenerationError("음성 변환 서버에 연결하지 못했습니다.", err);
  }

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const transcript = parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  return transcript;
}
