/**
 * 쇼츠·영상 배경음악 라이브러리 — Supabase 공개 버킷 'bgm'의 트랙 목록.
 * 사용자가 미리듣기 후 선택하면 녹화 스트림에 합친다(createCustomBed로 디코딩).
 * URL은 공개 Supabase URL(빌드 시 주입)로 구성한다.
 */
export interface BgmTrack {
  id: string;
  label: string;
  url: string;
}

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const bgmUrl = (id: string) => `${BASE}/storage/v1/object/public/bgm/${id}.mp3`;

/** 라이브러리 트랙(업로드 순서 01~16). 라벨은 '배경음악 N'. */
export const BGM_TRACKS: BgmTrack[] = Array.from({ length: 16 }, (_, i) => {
  const id = String(i + 1).padStart(2, "0");
  return { id, label: `배경음악 ${i + 1}`, url: bgmUrl(id) };
});

/** 라이브러리 사용 가능 여부(공개 URL이 구성됐는지). */
export const BGM_AVAILABLE = BASE.length > 0;
