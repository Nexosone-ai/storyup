// 배경음악(BGM) 라이브러리 업로드 — 공개 버킷 'bgm'에 mp3를 01.mp3..NN.mp3로 올린다.
// 실행: node --env-file=.env.local scripts/upload-bgm.mjs
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
  process.exit(1);
}
const supabase = createClient(url, key);

const DIR = "C:/Users/ceo/Downloads/";
// 사용자가 준 순서대로.
const FILES = [
  "leberch-background-background-music-610005.mp3",
  "echoes_of_lumen-good-background-music-597574.mp3",
  "andriih-background-music-background-599243.mp3",
  "nastelbom-background-music-vibe-617066.mp3",
  "mfcc-background-music-274290.mp3",
  "andriig-background-music-background-604062.mp3",
  "echoes_of_lumen-cool-background-music-596306.mp3",
  "nastelbom-background-music-602518.mp3",
  "atlasaudio-music-background-594872.mp3",
  "nastelbom-background-music-617073.mp3",
  "alex-morgan-background-background-music-578479.mp3",
  "the_mountain-background-music-159125.mp3",
  "nastelbom-background-music-606712.mp3",
  "atlasaudio-background-music-610019.mp3",
  "ikoliks_aj-background-music-320427.mp3",
  "jonasblakewood-background-music-618629.mp3",
];

const BUCKET = "bgm";

async function main() {
  // 공개 버킷 보장(이미 있으면 무시).
  const { error: bErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: "20MB",
    allowedMimeTypes: ["audio/mpeg"],
  });
  if (bErr && !/exists/i.test(bErr.message)) {
    console.error("버킷 생성 실패:", bErr.message);
    process.exit(1);
  }
  await supabase.storage.updateBucket(BUCKET, { public: true }).catch(() => {});

  let i = 0;
  for (const name of FILES) {
    i++;
    const idx = String(i).padStart(2, "0");
    const buf = await readFile(DIR + name);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${idx}.mp3`, buf, { contentType: "audio/mpeg", upsert: true });
    if (error) {
      console.error(`업로드 실패 ${idx} (${name}):`, error.message);
      process.exit(1);
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${idx}.mp3`);
    console.log(`OK ${idx} ${name} -> ${data.publicUrl}`);
  }
  console.log(`\n완료: ${FILES.length}곡 업로드됨 (bucket=${BUCKET})`);
}

main();
