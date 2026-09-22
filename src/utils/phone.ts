/**
 * 한국 휴대폰 번호 입력용 자동 하이픈 포맷.
 * 숫자만 남겨 최대 11자리로 자르고, 3-3-4(10자리)/3-4-4(11자리)로 하이픈을 넣는다.
 * 서버·PG로 보낼 때는 다시 숫자만 추출하므로 표시용으로만 쓴다.
 */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
