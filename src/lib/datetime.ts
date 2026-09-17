/**
 * 날짜 표시 유틸 — 절대 날짜 + 유튜브식 상대시간("N시간 전").
 * 상대시간은 "보는 사람 기준"이라 반드시 브라우저에서 계산해야 한다
 * (서버 렌더 값은 요청 시각 기준이라 뷰어의 시계와 다를 수 있음).
 * → 실제 표시는 클라이언트 컴포넌트 <RelativeTime>가 담당하고,
 *   여기의 순수 함수는 서버 폴백/타이틀 용도로도 재사용한다.
 */

export function formatDate(iso: string, ko: boolean): string {
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** iso 시각을 now(ms) 기준 상대시간 문자열로. 미래/직후는 "방금 전". */
export function timeAgo(iso: string, ko: boolean, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const month = Math.floor(day / 30);
  const year = Math.floor(day / 365);

  const en = (n: number, unit: string) => `${n} ${unit}${n > 1 ? "s" : ""} ago`;

  if (sec < 60) return ko ? "방금 전" : "just now";
  if (min < 60) return ko ? `${min}분 전` : en(min, "minute");
  if (hr < 24) return ko ? `${hr}시간 전` : en(hr, "hour");
  if (day < 30) return ko ? `${day}일 전` : en(day, "day");
  if (month < 12) return ko ? `${month}개월 전` : en(month, "month");
  return ko ? `${year}년 전` : en(year, "year");
}
