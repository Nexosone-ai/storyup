import type { ImageProvider } from "./provider";
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
