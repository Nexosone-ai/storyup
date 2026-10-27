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

// 배수는 5초(기본)를 1로 본 길이 비례값. UP 단가 = 관리자 AI_VIDEO 단가 × multiplier.
// 30초 이상은 모델(현 fal Seedance)이 단일 생성에서 거부할 수 있고, 그 경우 생성
// 실패로 처리되어 UP는 자동 환급된다(진짜 장편은 클립 이어붙이기 파이프라인이 필요).
export const VIDEO_LENGTHS: VideoLength[] = [
  { id: "s5", label: "기본 (약 5초)", seconds: 5, multiplier: 1 },
  { id: "s10", label: "길게 (약 10초)", seconds: 10, multiplier: 2 },
  { id: "s15", label: "약 15초", seconds: 15, multiplier: 3 },
  { id: "s30", label: "약 30초", seconds: 30, multiplier: 6 },
  { id: "s60", label: "약 1분", seconds: 60, multiplier: 12 },
  { id: "s120", label: "약 2분", seconds: 120, multiplier: 24 },
];

/** id로 길이 옵션 조회 — 없거나 빈 값이면 기본(첫 번째). */
export function videoLengthById(id?: string): VideoLength {
  return VIDEO_LENGTHS.find((l) => l.id === id) ?? VIDEO_LENGTHS[0];
}
