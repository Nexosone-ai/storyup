import { createAdminClient } from "@/lib/supabase/server";

const AUDIO_BUCKET = "site-audio";

/**
 * AI 생성 오디오(TTS WAV 등)를 공개 스토리지 `site-audio`에 저장하고 URL을 반환한다.
 * imageStore.storeGeneratedImage 미러 — 트랜스코딩 없이 그대로 저장(수 초짜리 WAV는 수백 KB).
 * 액션은 base64를 돌려주지 말고 이 URL만 돌려준다. 실패 시 null.
 */
export async function storeGeneratedAudio(
  businessId: string,
  folder: string,
  buffer: Buffer,
  contentType = "audio/wav",
): Promise<string | null> {
  const admin = createAdminClient();
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.some((b) => b.name === AUDIO_BUCKET)) {
      await admin.storage.createBucket(AUDIO_BUCKET, {
        public: true,
        fileSizeLimit: "25MB",
      });
    }
  } catch {
    // 버킷이 이미 있으면 업로드는 그대로 동작한다.
  }

  const ext = contentType.includes("mpeg")
    ? "mp3"
    : contentType.includes("mp4")
      ? "m4a"
      : contentType.includes("ogg")
        ? "ogg"
        : "wav";
  const path = `${businessId}/${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error } = await admin.storage
    .from(AUDIO_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) {
    console.error("[audioStore] upload failed", error);
    return null;
  }
  return admin.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
}
