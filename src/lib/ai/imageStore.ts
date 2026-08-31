import { createAdminClient } from "@/lib/supabase/server";

const IMAGE_BUCKET = "site-images";

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

  const ext = (image.mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `${businessId}/${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error } = await admin.storage
    .from(IMAGE_BUCKET)
    .upload(path, Buffer.from(image.b64, "base64"), {
      contentType: image.mime,
      upsert: false,
    });
  if (error) {
    console.error("[imageStore] upload failed", error);
    return null;
  }
  return admin.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
