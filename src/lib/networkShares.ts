/**
 * 유통 네트워크 수당 배분 — 순수 계산(의존성 없음, 단위 테스트 대상).
 * network.ts에서 재사용한다.
 */

export type NetworkRole = "distributor" | "agency" | "reseller";

// 상위 → 하위 순서 (index가 클수록 하위 단계)
export const ROLE_ORDER: NetworkRole[] = [
  "distributor",
  "agency",
  "reseller",
];

export const ROLE_LABEL: Record<NetworkRole, string> = {
  distributor: "총판",
  agency: "영업점",
  reseller: "리셀러",
};

export interface Split {
  distributor: number;
  agency: number;
  reseller: number;
}

export const clampPct = (n: number) =>
  Math.max(0, Math.min(100, Math.round(n || 0)));

/**
 * 풀(pool)을 배분비율로 나눈 뒤, "판매자가 하위 단계 몫을 흡수"하는 규칙을 적용해
 * 수혜 역할별 금액을 돌려준다. 합계는 항상 pool과 같다.
 * - 리셀러 판매: {distributor, agency, reseller} 각자 몫.
 * - 영업점 직접판매: 영업점이 리셀러 몫 흡수 → {distributor, agency+reseller}.
 * - 총판 직접판매: 전액 총판.
 */
export function computeNetworkShares(args: {
  pool: number;
  split: Split;
  sellerRole: NetworkRole;
}): Record<NetworkRole, number> {
  const { pool, split, sellerRole } = args;
  const dist = Math.floor((pool * clampPct(split.distributor)) / 100);
  const agency = Math.floor((pool * clampPct(split.agency)) / 100);
  const reseller = pool - dist - agency; // 나머지로 보정 → 합 = pool
  const roleShare: Record<NetworkRole, number> = {
    distributor: dist,
    agency,
    reseller,
  };
  const sellerIdx = ROLE_ORDER.indexOf(sellerRole);
  const out: Record<NetworkRole, number> = {
    distributor: 0,
    agency: 0,
    reseller: 0,
  };
  for (let i = 0; i < ROLE_ORDER.length; i++) {
    const role = ROLE_ORDER[i];
    if (i < sellerIdx) out[role] += roleShare[role]; // 상위 → 해당 상위 멤버
    else out[sellerRole] += roleShare[role]; // 판매자 역할 이하 → 판매자 흡수
  }
  return out;
}
