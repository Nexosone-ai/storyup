/**
 * Google AdSense 퍼블리셔 ID 유틸 — 사용자 입력을 신뢰하지 않고 항상 정규화한다.
 * 발행 사이트 <head> 스크립트와 ads.txt로 나가는 값은 반드시 이 함수를 거친다
 * (임의 문자열이 script src / 텍스트 출력에 그대로 들어가는 것을 막는다).
 */

/** AdSense 인증 기관(certification authority) ID — ads.txt 라인의 고정 상수. */
const ADSENSE_TAG_ID = "f08c47fec0942fa0";

/**
 * 입력에서 AdSense 퍼블리셔 ID를 정규화한다.
 * "ca-pub-1234567890123456", "pub-1234567890123456", 공백 포함 입력 등을 받아
 * 유효하면 "ca-pub-################"(16자리)로, 아니면 null을 반환한다.
 */
export function normalizeAdsensePublisherId(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  // 정확히 16자리만 — 뒤에 숫자가 더 붙은(17자리 이상) 모호한 입력은 거부한다.
  const m = raw.trim().match(/(?:ca-)?pub-(\d{16})(?!\d)/i);
  return m ? `ca-pub-${m[1]}` : null;
}

/**
 * 정규화된 클라이언트 ID로 ads.txt 한 줄을 만든다.
 * 예: "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0"
 */
export function adsenseAdsTxtLine(clientId: string): string | null {
  const m = clientId.match(/pub-(\d{16})/);
  return m ? `google.com, pub-${m[1]}, DIRECT, ${ADSENSE_TAG_ID}` : null;
}
