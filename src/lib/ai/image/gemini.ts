import type {
  ImageProvider,
  GeneratedImage,
  ImageAspect,
} from "./provider";
import { ImageGenerationError } from "./provider";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

/** Google Gemini image generation ("Nano Banana"). Server-only. */
export class GeminiImageProvider implements ImageProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey = process.env.GEMINI_API_KEY, model = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new ImageGenerationError(
        "이미지 생성이 설정되지 않았습니다. (GEMINI_API_KEY 누락)",
      );
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateImage(
    prompt: string,
    aspect: ImageAspect = "3:4",
  ): Promise<GeneratedImage> {
    let json: {
      candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
      error?: { message?: string };
    };
    try {
      const res = await fetch(
        `${ENDPOINT}/${this.model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              imageConfig: { aspectRatio: aspect },
            },
          }),
        },
      );
      json = await res.json();
      if (!res.ok) {
        // 업스트림 원문(영문)은 로그로만 남기고 사용자에겐 안내 문구를 보여준다.
        console.error("[gemini-image]", res.status, json?.error?.message);
        throw new ImageGenerationError(
          res.status === 429 || res.status >= 500
            ? "이미지 서버가 혼잡합니다. 잠시 후 다시 시도해주세요."
            : `이미지 생성 실패 (${res.status})`,
        );
      }
    } catch (err) {
      if (err instanceof ImageGenerationError) throw err;
      throw new ImageGenerationError("이미지 서버에 연결하지 못했습니다.", err);
    }

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      const inline = p.inlineData ?? p.inline_data;
      const data = inline?.data;
      if (data) {
        const mime =
          (inline as { mimeType?: string; mime_type?: string }).mimeType ??
          (inline as { mime_type?: string }).mime_type ??
          "image/png";
        return { b64: data, mime };
      }
    }
    throw new ImageGenerationError("이미지를 생성하지 못했습니다. 다시 시도해주세요.");
  }
}
