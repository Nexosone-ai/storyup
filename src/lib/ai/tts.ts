import { AIGenerationError } from "./provider";

/**
 * 음성 합성(TTS) — Gemini TTS 모델을 raw REST(generateContent)로 호출한다. Server-only.
 * 응답 오디오는 모델/버전에 따라 완성 WAV(audio/wav) 또는 헤더 없는 PCM
 * (audio/L16;codec=pcm;rate=24000)으로 오므로 둘 다 받아 항상 WAV Buffer로 돌려준다.
 * 길이(durationMs)는 PCM 바이트 수로 서버에서 계산해 클라이언트가 디코딩 없이 타임라인을 짤 수 있게 한다.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL =
  process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";

/** 한 번에 합성할 텍스트 상한(장면 1개 분량이면 충분). */
export const TTS_MAX_CHARS = 1200;

export interface SpeechResult {
  /** RIFF 헤더가 붙은 WAV(16bit PCM). */
  wav: Buffer;
  mime: "audio/wav";
  sampleRate: number;
  channels: number;
  durationMs: number;
}

/** 16bit PCM에 44바이트 RIFF/WAVE 헤더를 붙인다. */
export function wavFromPcm16(
  pcm: Buffer,
  sampleRate = 24000,
  channels = 1,
): Buffer {
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** WAV 헤더에서 샘플레이트·채널·PCM 바이트 수를 읽는다(표준 44바이트 헤더 가정, 실패 시 기본값). */
function readWavInfo(wav: Buffer): {
  sampleRate: number;
  channels: number;
  pcmBytes: number;
} {
  try {
    if (wav.length >= 44 && wav.toString("ascii", 0, 4) === "RIFF") {
      const channels = wav.readUInt16LE(22) || 1;
      const sampleRate = wav.readUInt32LE(24) || 24000;
      // data 청크를 찾는다(보통 36 위치). 없으면 44바이트 이후 전체.
      let off = 12;
      while (off + 8 <= wav.length) {
        const id = wav.toString("ascii", off, off + 4);
        const size = wav.readUInt32LE(off + 4);
        if (id === "data") return { sampleRate, channels, pcmBytes: Math.min(size, wav.length - off - 8) };
        off += 8 + size + (size % 2);
      }
      return { sampleRate, channels, pcmBytes: Math.max(0, wav.length - 44) };
    }
  } catch {
    /* fallthrough */
  }
  return { sampleRate: 24000, channels: 1, pcmBytes: Math.max(0, wav.length - 44) };
}

/** `audio/L16;codec=pcm;rate=24000` 같은 MIME에서 rate/channels 파라미터를 읽는다. */
function parseAudioMime(mime: string): {
  base: string;
  rate: number;
  channels: number;
} {
  const [base, ...params] = mime.split(";").map((s) => s.trim().toLowerCase());
  let rate = 24000;
  let channels = 1;
  for (const p of params) {
    const [k, v] = p.split("=");
    if (k === "rate" && Number(v) > 0) rate = Number(v);
    if ((k === "channels" || k === "ch") && Number(v) > 0) channels = Number(v);
  }
  return { base, rate, channels };
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

/**
 * 텍스트 → 음성(WAV). 보이스는 Gemini 프리셋 이름(Charon, Kore …).
 * style은 읽기 지시(영어 권장)로 텍스트 앞에 붙는다 — 미리보기 TTS 모델의 공식 제어 방식.
 */
export async function synthesizeSpeech(input: {
  text: string;
  voice: string;
  style?: string;
}): Promise<SpeechResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new AIGenerationError("음성 합성이 설정되지 않았습니다. (GEMINI_API_KEY 누락)");
  const text = input.text.trim().slice(0, TTS_MAX_CHARS);
  if (!text) throw new AIGenerationError("합성할 내용이 비어 있습니다.");
  const style =
    input.style ??
    "Read the following Korean narration clearly, in a warm and confident tone, at a moderate pace:";
  const prompt = `${style}\n${text}`;

  const call = async (): Promise<GeminiPart | null> => {
    let json: {
      candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
      error?: { message?: string };
    };
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}/${DEFAULT_MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: input.voice } },
            },
          },
        }),
      });
      json = await res.json();
    } catch (err) {
      throw new AIGenerationError("음성 합성 서버에 연결하지 못했습니다.", err);
    }
    if (!res.ok) {
      console.error("[tts]", res.status, json?.error?.message);
      throw new AIGenerationError(
        res.status === 429 || res.status >= 500
          ? "음성 합성 서버가 혼잡합니다. 잠시 후 다시 시도해주세요."
          : `음성 합성에 실패했습니다. (${res.status})`,
      );
    }
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    return parts.find((p) => p.inlineData?.data || p.inline_data?.data) ?? null;
  };

  // 가끔 오디오 파트 없이 돌아오므로 1회 재시도.
  let part = await call();
  if (!part) part = await call();
  const inline = part?.inlineData ?? part?.inline_data;
  const data = inline?.data;
  const mime = (inline as { mimeType?: string })?.mimeType ??
    (inline as { mime_type?: string })?.mime_type ??
    "audio/L16;codec=pcm;rate=24000";
  if (!data) throw new AIGenerationError("음성 합성 결과를 받지 못했습니다. 다시 시도해주세요.");

  const raw = Buffer.from(data, "base64");
  const { base, rate, channels } = parseAudioMime(mime);
  let wav: Buffer;
  let sampleRate: number;
  let ch: number;
  let pcmBytes: number;
  if (base === "audio/wav" || base === "audio/x-wav" || base === "audio/wave") {
    wav = raw;
    const info = readWavInfo(raw);
    sampleRate = info.sampleRate;
    ch = info.channels;
    pcmBytes = info.pcmBytes;
  } else {
    // audio/L16 · audio/pcm 등 헤더 없는 16bit PCM.
    wav = wavFromPcm16(raw, rate, channels);
    sampleRate = rate;
    ch = channels;
    pcmBytes = raw.length;
  }
  const durationMs = Math.round((pcmBytes / (sampleRate * 2 * ch)) * 1000);
  if (durationMs <= 0)
    throw new AIGenerationError("음성 합성 결과가 비어 있습니다. 다시 시도해주세요.");
  return { wav, mime: "audio/wav", sampleRate, channels: ch, durationMs };
}
