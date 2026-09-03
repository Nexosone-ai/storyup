import type {
  ImageProvider,
  GeneratedImage,
  ImageAspect,
} from "./provider";
import { ImageGenerationError } from "./provider";

const DEFAULT_MODEL = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/schnell";

const SIZE: Record<ImageAspect, string> = {
  "1:1": "square_hd",
  "3:4": "portrait_4_3",
  "9:16": "portrait_16_9",
  "4:3": "landscape_4_3",
  "16:9": "landscape_16_9",
};

/** fal.ai (FLUX) image generation. Server-only. Returns base64 (CORS-safe). */
export class FalImageProvider implements ImageProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey = process.env.FAL_KEY, model = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new ImageGenerationError(
        "이미지 생성이 설정되지 않았습니다. (FAL_KEY 누락)",
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
      images?: Array<{ url?: string; content_type?: string }>;
      detail?: unknown;
      error?: string;
    };
    try {
      const res = await fetch(`https://fal.run/${this.model}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          image_size: SIZE[aspect],
          num_images: 1,
          enable_safety_checker: true,
        }),
      });
      json = await res.json();
      if (!res.ok) {
        // 업스트림 원문(영문)은 로그로만 남기고 사용자에겐 안내 문구를 보여준다.
        console.error(
          "[fal-image]",
          res.status,
          typeof json?.detail === "string" ? json.detail : json?.error,
        );
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

    const url = json.images?.[0]?.url;
    const mime = json.images?.[0]?.content_type ?? "image/jpeg";
    if (!url)
      throw new ImageGenerationError(
        "이미지를 생성하지 못했습니다. 다시 시도해주세요.",
      );

    // Fetch the hosted image and inline as base64 so the client PNG export
    // never hits a cross-origin canvas taint.
    try {
      const imgRes = await fetch(url);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      return { b64: buf.toString("base64"), mime };
    } catch (err) {
      throw new ImageGenerationError("생성된 이미지를 불러오지 못했습니다.", err);
    }
  }
}
