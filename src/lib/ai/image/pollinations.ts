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

// 무키 서비스라 datacenter IP에서 간헐적 5xx/지연이 잦다. 빠른 모델(turbo, ~10s)로
// 기본값을 잡고 짧은 타임아웃으로 여러 번 재시도해 Vercel 60초 예산 안에서 성공률을 높인다.
const MAX_ATTEMPTS = 3;
const PER_ATTEMPT_MS = 18000;

/**
 * Pollinations — free, keyless image generation. Server-only 폴백 프로바이더.
 * 유료 프로바이더(Gemini/Fal)가 실패할 때만 쓰인다. 기본 모델은 속도·안정성을
 * 위해 turbo(SDXL-Turbo); 품질 우선이면 POLLINATIONS_MODEL=flux 로 바꿀 수 있다.
 * 이미지를 받아 base64로 반환한다(클라이언트 export의 CORS taint 방지).
 */
export class PollinationsImageProvider implements ImageProvider {
  private model: string;

  constructor(model = process.env.POLLINATIONS_MODEL || "turbo") {
    this.model = model;
  }

  async generateImage(
    prompt: string,
    aspect: ImageAspect = "3:4",
  ): Promise<GeneratedImage> {
    const { w, h } = DIMS[aspect];
    let lastErr: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Pollinations는 동일 프롬프트를 캐시해 같은 이미지를 돌려주므로,
      // "다시 생성"·재시도가 실제로 새 이미지를 만들도록 매 호출 랜덤 시드를 부여한다.
      const seed = Math.floor(Math.random() * 1_000_000_000);
      const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
        `?width=${w}&height=${h}&model=${encodeURIComponent(this.model)}&nologo=true&seed=${seed}`;

      try {
        const res = await fetch(url, {
          headers: { Accept: "image/*" },
          signal: AbortSignal.timeout(PER_ATTEMPT_MS),
        });
        if (!res.ok) {
          // 5xx·429는 일시적 → 재시도, 그 외(4xx)는 즉시 실패.
          lastErr = new ImageGenerationError(`이미지 생성 실패 (${res.status})`);
          if (res.status >= 500 || res.status === 429) continue;
          throw lastErr;
        }
        const mime = res.headers.get("content-type") ?? "image/jpeg";
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1024) {
          lastErr = new ImageGenerationError("이미지를 생성하지 못했습니다.");
          continue; // 빈 응답 → 재시도
        }
        return { b64: buf.toString("base64"), mime };
      } catch (err) {
        // 타임아웃·네트워크 오류 → 다음 시도로. 4xx는 위에서 이미 throw됨.
        lastErr = err;
      }
    }

    if (lastErr instanceof ImageGenerationError) throw lastErr;
    throw new ImageGenerationError("이미지 서버에 연결하지 못했습니다.", lastErr);
  }
}
