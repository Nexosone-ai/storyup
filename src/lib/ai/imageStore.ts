import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";

const IMAGE_BUCKET = "site-images";

/**
 * AI 생성 이미지를 저장 전에 리사이즈·압축한다 (저장·전송량 절감).
 * 많은 프로바이더가 큰 PNG를 돌려줘 그대로 저장하면 수 MB에 달한다. 가로 1600px
 * 상한 + JPEG 품질 82로 재인코딩하면 대개 수백 KB로 줄고, OG·소셜 공유에도 안전하다.
 * sharp 실패 시 원본을 그대로 저장한다(기능 우선).
 */
async function compressForStorage(
  b64: string,
  mime: string,
  maxWidth = 1600,
  quality = 82,
): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const input = Buffer.from(b64, "base64");
  try {
    const out = await sharp(input)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    return { buffer: out, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    const ext = (mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
    return { buffer: input, contentType: mime, ext };
  }
}

/** AI 생성 이미지를 공개 스토리지에 저장하고 URL을 반환한다. 실패 시 null. */
export async function storeGeneratedImage(
  businessId: string,
  folder: string,
  image: { b64: string; mime: string },
): Promise<string | null> {
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

  const { buffer, contentType, ext } = await compressForStorage(
    image.b64,
    image.mime,
  );
  const path = `${businessId}/${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error } = await admin.storage
    .from(IMAGE_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) {
    console.error("[imageStore] upload failed", error);
    return null;
  }
  return admin.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
