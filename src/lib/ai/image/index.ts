import type { ImageProvider, GeneratedImage, ImageAspect } from "./provider";
import { GeminiImageProvider } from "./gemini";
import { FalImageProvider } from "./fal";
import { PollinationsImageProvider } from "./pollinations";

export { ImageGenerationError } from "./provider";
export type { ImageProvider, ImageAspect } from "./provider";

let cached: ImageProvider | null = null;

/**
 * 유료 플랜 기본 프로바이더 (server-only). IMAGE_PROVIDER
 * ("pollinations" | "fal" | "gemini")로 선택, 없으면 키가 있는 쪽(fal → gemini),
 * 둘 다 없으면 무키 Pollinations.
 */
function getPremiumProvider(): ImageProvider {
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

/**
 * 활성 이미지 프로바이더.
 * - premium=true(고화질 — Pro·파트너, plans.premiumImages): 위 설정 프로바이더(운영은 Gemini ~₩55/장).
 * - premium=false(무료·기본 상품 Basic): fal(FLUX schnell, 장당 ~₩4). 월 한도는
 *   src/lib/ai/imageQuota.ts. FAL_KEY가 없으면 고화질 프로바이더로 대신 처리.
 *   호출부는 premiumImagesFor(planId) 로 판정한다(2026-11-09, 기본 상품 원가 절감).
 *
 * 2026-11 이전 무료 플랜이 쓰던 무키 Pollinations는 IP당 ~17초에 1장으로 제한되기
 * 시작해(402) 연속 생성이 전부 실패하므로 더는 1차 프로바이더로 쓰지 않는다.
 */
export function getImageProvider(premium = true): ImageProvider {
  if (!premium && process.env.FAL_KEY) return new FalImageProvider();
  return getPremiumProvider();
}

/** Image generation is always available (Pollinations needs no key). */
export function isImageGenConfigured(): boolean {
  return true;
}

/**
 * 이미지 생성 — 플랜별 프로바이더로 시도하되 실패하면 다른 프로바이더로 폴백한다.
 * 폴백 순서: 1차 → fal(키 있고 1차가 fal이 아닐 때) → 무키 Pollinations(최후).
 * (Gemini 키 만료·쿼터·일시 오류로 이미지가 아예 안 나오는 상황을 방지.)
 */
export async function generateImageResilient(
  prompt: string,
  aspect?: ImageAspect,
  opts?: { premium?: boolean },
): Promise<GeneratedImage> {
  let primary: ImageProvider | null = null;
  try {
    primary = getImageProvider(opts?.premium ?? true);
    return await primary.generateImage(prompt, aspect);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 2차: fal (1차가 fal이 아니고 키가 있을 때)
    if (!(primary instanceof FalImageProvider) && process.env.FAL_KEY) {
      console.error("[image] 1차 프로바이더 실패 → fal로 폴백", msg);
      try {
        return await new FalImageProvider().generateImage(prompt, aspect);
      } catch (err2) {
        console.error(
          "[image] fal 폴백 실패",
          err2 instanceof Error ? err2.message : err2,
        );
      }
    }
    // 최후: 무키 Pollinations (느리고 제한이 커서 마지막 수단).
    if (primary instanceof PollinationsImageProvider) throw err;
    console.error("[image] Pollinations로 최종 폴백", msg);
    return await new PollinationsImageProvider().generateImage(prompt, aspect);
  }
}
