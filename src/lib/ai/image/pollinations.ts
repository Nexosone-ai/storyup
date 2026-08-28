import type {
  ImageProvider,
  GeneratedImage,
  ImageAspect,
} from "./provider";
import { ImageGenerationError } from "./provider";

const DIMS: Record<ImageAspect, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 },
  "3:4": { w: 900, h: 1200 },
  "9:16": { w: 720, h: 1280 },
  "4:3": { w: 1200, h: 900 },
  "16:9": { w: 1280, h: 720 },
};

/**
 * Pollinations — free, keyless image generation (FLUX). Server-only.
 * Fetches the image and returns base64 (CORS-safe for the client export).
 */
export class PollinationsImageProvider implements ImageProvider {
  private model: string;

  constructor(model = process.env.POLLINATIONS_MODEL || "flux") {
    this.model = model;
  }

  async generateImage(
    prompt: string,
    aspect: ImageAspect = "3:4",
  ): Promise<GeneratedImage> {
    const { w, h } = DIMS[aspect];
    // Pollinations는 동일 프롬프트를 캐시해 같은 이미지를 돌려주므로,
    // "다시 생성"이 실제로 새 이미지를 만들도록 매 호출 랜덤 시드를 부여한다.
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?width=${w}&height=${h}&model=${encodeURIComponent(this.model)}&nologo=true&seed=${seed}`;

    try {
      const res = await fetch(url, {
        headers: { Accept: "image/*" },
        signal: AbortSignal.timeout(55000),
      });
      if (!res.ok) {
        throw new ImageGenerationError(`이미지 생성 실패 (${res.status})`);
      }
      const mime = res.headers.get("content-type") ?? "image/jpeg";
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) {
        throw new ImageGenerationError("이미지를 생성하지 못했습니다.");
      }
      return { b64: buf.toString("base64"), mime };
    } catch (err) {
      if (err instanceof ImageGenerationError) throw err;
      throw new ImageGenerationError("이미지 서버에 연결하지 못했습니다.", err);
    }
  }
}
