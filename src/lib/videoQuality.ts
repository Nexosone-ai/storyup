/**
 * AI 영상 화질(해상도) 옵션 — 화질이 높을수록 크레딧을 배수로 더 차감한다.
 * fal Seedance 2.5 초당 원가: 480p $0.2205 · 720p $0.473(×2.1) · 1080p $1.164(×5.3)
 * → 배수를 1 / 2 / 5 로 두면 어느 화질이든 본사 마진율이 비슷하게 유지된다.
 * 기본은 480p(가장 저렴). 서버·클라이언트 공용('server-only' 아님). videoLength.ts 와 같은 패턴.
 */
export interface VideoQuality {
  id: "480p" | "720p" | "1080p";
  /** 사용자에게 보여줄 라벨. */
  label: string;
  /** 크레딧 단가 배수(기본 480p = 1). */
  multiplier: number;
}

export const VIDEO_QUALITIES: VideoQuality[] = [
  { id: "480p", label: "기본 480p (빠름)", multiplier: 1 },
  { id: "720p", label: "HD 720p", multiplier: 2 },
  { id: "1080p", label: "FHD 1080p", multiplier: 5 },
];

/** 엔진 기본 해상도 — 호출부가 resolution 을 지정하지 않으면 이 값을 쓴다. */
export const DEFAULT_VIDEO_RESOLUTION: VideoQuality["id"] = "480p";

/** id로 화질 옵션 조회 — 없거나 빈 값이면 기본(480p). */
export function videoQualityById(id?: string): VideoQuality {
  return VIDEO_QUALITIES.find((q) => q.id === id) ?? VIDEO_QUALITIES[0];
}
