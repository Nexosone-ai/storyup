import { getAIProvider } from "@/lib/ai";
import { getImageProvider } from "@/lib/ai/image";
import { buildBlogCoverPrompt } from "@/lib/ai/image/prompt";
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
}): Promise<string | null> {
  try {
    const scene = await getAIProvider()
      .generateImageSubject({
        category: opts.category,
        text: opts.paragraph,
        kind: "still-life",
      })
      .catch(() => opts.paragraph.replace(/\s+/g, " ").trim().slice(0, 120));
    const prompt = buildBlogCoverPrompt(opts.category, scene);

    const image = await getImageProvider().generateImage(prompt, "4:3");
    if (!image) return null;

    return await storeGeneratedImage(opts.businessId, "blog-body", image);
  } catch (err) {
    console.error("[blogBodyImage]", err);
    return null;
  }
}
