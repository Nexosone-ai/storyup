/**
 * 광고 과금 분배 — 순수 계산(의존성 없음, 단위 테스트 대상).
 * 광고주 차감액(bid)에서 플랫폼 수수료%를 떼고 나머지를 블로거 수익으로.
 */
export function splitClickCharge(
  bid: number,
  feePct: number,
): { advertiser: number; fee: number; blogger: number } {
  const advertiser = Math.max(0, Math.round(bid || 0));
  const pct = Math.max(0, Math.min(100, Math.round(feePct || 0)));
  const fee = Math.round((advertiser * pct) / 100);
  const blogger = advertiser - fee;
  return { advertiser, fee, blogger };
}
