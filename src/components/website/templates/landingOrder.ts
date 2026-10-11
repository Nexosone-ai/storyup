import {
  LANDING_SECTION_KEYS,
  type LandingSectionKey,
  type WebsiteContent,
} from "@/types/domain";

/**
 * 메인(랜딩) 섹션의 최종 렌더 순서를 돌려준다.
 * - content.sectionOrder(저장된 순서)를 먼저 적용하고, 빠진 키는 기본 순서로 뒤에 붙인다.
 * - content.hiddenSections에 든 키는 제외한다.
 * - 각 블록은 자체적으로 내용이 없으면 null을 렌더하므로, 키가 있어도 빈 섹션은 안 나온다.
 * 기본값(순서·숨김 미설정)이면 LANDING_SECTION_KEYS 순서 = 기존과 동일(하위호환).
 */
export function orderedLandingKeys(content: WebsiteContent): LandingSectionKey[] {
  const hidden = new Set(content.hiddenSections ?? []);
  const seen = new Set<LandingSectionKey>();
  const result: LandingSectionKey[] = [];
  for (const k of content.sectionOrder ?? []) {
    if (LANDING_SECTION_KEYS.includes(k) && !seen.has(k)) {
      seen.add(k);
      result.push(k);
    }
  }
  for (const k of LANDING_SECTION_KEYS) {
    if (!seen.has(k)) {
      seen.add(k);
      result.push(k);
    }
  }
  return result.filter((k) => !hidden.has(k));
}
