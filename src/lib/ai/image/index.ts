import type { ImageProvider, GeneratedImage, ImageAspect } from "./provider";
import { GeminiImageProvider } from "./gemini";
import { FalImageProvider } from "./fal";
import { PollinationsImageProvider } from "./pollinations";

export { ImageGenerationError } from "./provider";
export type { ImageProvider, ImageAspect } from "./provider";

let cached: ImageProvider | null = null;

/**
 * Active image provider (server-only). Selected by IMAGE_PROVIDER
 * ("pollinations" | "fal" | "gemini"), else inferred from whichever key is
 * present (fal → gemini), else the free Pollinations fallback.
 */
export function getImageProvider(): ImageProvider {
  if (cached) return cached;
  const choice = process.env.IMAGE_PROVIDER?.toLowerCase();

  if (choice === "pollinations") cached = new PollinationsImageProvider();
  else if (choice === "fal") cached = new FalImageProvider();
  else if (choice === "gemini") cached = new GeminiImageProvider();
  else if (process.env.FAL_KEY) cached = new FalImageProvider();
  else if (process.env.GEMINI_API_KEY) cached = new GeminiImageProvider();
  else cached = new PollinationsImageProvider();

  return cached;
}

/** Image generation is always available (Pollinations needs no key). */
export function isImageGenConfigured(): boolean {
  return true;
}

/**
 * 이미지 생성 — 설정된 프로바이더로 시도하되 실패하면 무키 Pollinations로 폴백한다.
 * (Gemini/Fal 키 만료·쿼터·오류로 이미지가 아예 안 나오는 상황을 방지.)
 */
export async function generateImageResilient(
  prompt: string,
  aspect?: ImageAspect,
): Promise<GeneratedImage> {
  let primary: ImageProvider | null = null;
  try {
    primary = getImageProvider();
    return await primary.generateImage(prompt, aspect);
  } catch (err) {
    // 이미 폴백 프로바이더였다면 그대로 실패를 던진다.
    if (primary instanceof PollinationsImageProvider) throw err;
    // 프로바이더 생성 실패(키 누락) 또는 생성 오류(쿼터·만료) → 무키 Pollinations로 폴백.
    console.error(
      "[image] 기본 프로바이더 실패 → Pollinations로 폴백",
      err instanceof Error ? err.message : err,
    );
    return await new PollinationsImageProvider().generateImage(prompt, aspect);
  }
}
