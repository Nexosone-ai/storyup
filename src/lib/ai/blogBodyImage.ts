import { getAIProvider } from "@/lib/ai";
import { generateImageResilient } from "@/lib/ai/image";
import { buildBlogImagePrompt } from "@/lib/ai/image/prompt";
import type { ImageStyleId } from "@/lib/ai/image/style";
import { storeGeneratedImage } from "@/lib/ai/imageStore";

/**
 * 블로그 본문 한 단락에 어울리는 이미지를 생성해 스토리지에 올리고 공개 URL을 반환한다.
 * 단락 텍스트로 영문 피사체를 만든 뒤 커버와 같은 정물 프롬프트를 4:3으로 생성한다.
 * 실패는 어떤 오류든 null로 수렴한다 (에디터 흐름을 막지 않음).
 */
export async function generateAndStoreBlogBodyImage(opts: {
  businessId: string;
  category: string;
  paragraph: string;
  style?: ImageStyleId;
  /** 사용자가 원하는 이미지를 직접 설명한 경우 — 있으면 글 내용 대신 이 설명으로 피사체를 만든다. */
  instruction?: string;
}): Promise<string | null> {
  try {
    // 설명이 있으면 설명을, 없으면 글 내용을 피사체 생성의 근거로 쓴다.
    const basis = opts.instruction?.trim() || opts.paragraph;
    const scene = await getAIProvider()
      .generateImageSubject({
        category: opts.category,
        text: basis,
        kind: "scene",
      })
      .catch(() => basis.replace(/\s+/g, " ").trim().slice(0, 120));
    const prompt = buildBlogImagePrompt(opts.category, scene, opts.style);

    const image = await generateImageResilient(prompt, "4:3");
    if (!image) return null;

    return await storeGeneratedImage(opts.businessId, "blog-body", image);
  } catch (err) {
    console.error("[blogBodyImage]", err);
    return null;
  }
}
