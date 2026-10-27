/**
 * AI 영상 길이 옵션 — 길이가 길수록 UP를 배수로 더 차감한다.
 * seconds는 fal 영상 모델에 전달하는 길이(초), multiplier는 UP 단가 배수.
 * 서버·클라이언트 공용(‘server-only’ 아님).
 */
export interface VideoLength {
  id: string;
  /** 사용자에게 보여줄 라벨. */
  label: string;
  /** fal 모델에 넘길 영상 길이(초). */
  seconds: number;
  /** UP 단가 배수(기본=1). */
  multiplier: number;
}

export const VIDEO_LENGTHS: VideoLength[] = [
  { id: "short", label: "기본 (약 5초)", seconds: 5, multiplier: 1 },
  { id: "long", label: "길게 (약 10초)", seconds: 10, multiplier: 2 },
];

/** id로 길이 옵션 조회 — 없거나 빈 값이면 기본(첫 번째). */
export function videoLengthById(id?: string): VideoLength {
  return VIDEO_LENGTHS.find((l) => l.id === id) ?? VIDEO_LENGTHS[0];
}
