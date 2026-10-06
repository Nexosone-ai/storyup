import { createAdminClient } from "@/lib/supabase/server";
import { getAIProvider } from "@/lib/ai";
import { generateImageResilient } from "@/lib/ai/image";
import { buildBlogImagePrompt } from "@/lib/ai/image/prompt";
import type { ImageStyleId } from "@/lib/ai/image/style";

const IMAGE_BUCKET = "site-images";

/**
 * 블로그 커버 이미지를 생성해 스토리지에 올리고 공개 URL을 반환한다.
 * 실패는 글 생성 자체를 막으면 안 되므로 어떤 오류든 null로 수렴한다.
 * timeoutMs를 넘기면 포기한다 — 글 생성 API의 함수 실행 시간 예산 보호용.
 */
export async function generateAndStoreBlogCover(opts: {
  businessId: string;
  category: string;
  title: string;
  keywords: string[];
  /** 블로그 생성 결과의 image_subject (영문). 없으면 제목·키워드로 즉석 생성. */
  imageSubject?: string;
  style?: ImageStyleId;
  /** 사용자가 원하는 커버를 직접 설명한 경우 — 있으면 제목·키워드 대신 이 설명으로 피사체를 만든다. */
  instruction?: string;
  timeoutMs?: number;
}): Promise<string | null> {
  try {
    const instruction = opts.instruction?.trim();
    const scene = instruction
      ? await getAIProvider()
          .generateImageSubject({ category: opts.category, text: instruction })
          .catch(() => instruction)
      : opts.imageSubject?.trim() ||
        (await getAIProvider()
          .generateImageSubject({
            category: opts.category,
            text: [opts.title, ...opts.keywords].join(", "),
          })
          .catch(() => opts.keywords.join(", ") || opts.title));
    const prompt = buildBlogImagePrompt(opts.category, scene, opts.style);

    const generate = generateImageResilient(prompt, "16:9");
    const image = opts.timeoutMs
      ? await Promise.race([
          generate,
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), opts.timeoutMs),
          ),
        ])
      : await generate;
    if (!image) return null;

    const admin = createAdminClient();
    try {
      const { data: buckets } = await admin.storage.listBuckets();
      if (!buckets?.some((b) => b.name === IMAGE_BUCKET)) {
        await admin.storage.createBucket(IMAGE_BUCKET, {
          public: true,
          fileSizeLimit: "10MB",
        });
      }
    } catch {
      // 버킷이 이미 있으면 업로드는 그대로 동작한다.
    }

    const ext = (image.mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${opts.businessId}/blog-covers/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const { error } = await admin.storage
      .from(IMAGE_BUCKET)
      .upload(path, Buffer.from(image.b64, "base64"), {
        contentType: image.mime,
        upsert: false,
      });
    if (error) return null;

    return admin.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.error("[blogCover]", err);
    return null;
  }
}
