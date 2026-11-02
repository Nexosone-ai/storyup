import { getAIProvider } from "@/lib/ai";
import { generateImageResilient } from "@/lib/ai/image";
import { buildBlogImagePrompt } from "@/lib/ai/image/prompt";
import { storeGeneratedImage } from "@/lib/ai/imageStore";
import type { ImageStyleId } from "@/lib/ai/image/style";
import type { PromptLanguage } from "@/lib/ai/prompts/brand-story";

/**
 * 글 '요약' 이미지 — 제목이 아니라 본문 내용을 요약한 장면으로 한 장 만들어
 * 스토리지에 올리고 공개 URL을 반환한다(SNS 공유·썸네일용). 정사각(1:1).
 * 실패는 어떤 오류든 null로 수렴한다(커버 생성과 동일 정책).
 */
export async function generateAndStoreBlogSummaryImage(opts: {
  businessId: string;
  category: string;
  title: string;
  summary?: string;
  content: string;
  style?: ImageStyleId;
  language?: PromptLanguage;
  timeoutMs?: number;
}): Promise<string | null> {
  try {
    const language = opts.language ?? "ko";
    // 제목·요약·본문 앞부분을 합쳐 '내용을 요약한' 장면 피사체를 만든다.
    const basis = [opts.title, opts.summary ?? "", opts.content]
      .filter(Boolean)
      .join("\n")
      .replace(/\s+/g, " ")
      .slice(0, 1800);
    const scene = await getAIProvider()
      .generateImageSubject({
        category: opts.category,
        text: basis,
        kind: "scene",
        language,
      })
      .catch(() => opts.title);
    const prompt = buildBlogImagePrompt(opts.category, scene, opts.style, {
      language,
    });

    const generate = generateImageResilient(prompt, "1:1");
    const image = opts.timeoutMs
      ? await Promise.race([
          generate,
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), opts.timeoutMs),
          ),
        ])
      : await generate;
    if (!image) return null;

    return await storeGeneratedImage(opts.businessId, "blog-summaries", image);
  } catch (err) {
    console.error("[blogSummaryImage]", err);
    return null;
  }
}
