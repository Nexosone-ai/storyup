/**
 * 광고 게재 검수 보조 — 글 본문에서 근거 없는 주장·가상 사례·건강/투자 효능 표현 등
 * Google 애드센스 품질 정책(빈약한 콘텐츠·오해 소지 주장)에 걸리기 쉬운 표현을 찾아낸다.
 * 서버·클라이언트 공용(순수 함수). 결과는 참고용 — 최종 판단은 관리자 검수.
 */
export interface AdRiskSignal {
  key: string;
  label: string;
  /** 왜 문제인지·어떻게 고치는지. */
  advice: string;
  /** 본문에서 찾은 표현(중복 제거, 최대 5개). */
  matches: string[];
  severity: "high" | "medium";
}

interface Rule {
  key: string;
  label: string;
  advice: string;
  severity: "high" | "medium";
  re: RegExp;
}

const RULES: Rule[] = [
  {
    key: "example_person",
    label: "가상 인물·예시 사례",
    advice:
      "'(예시)'·'가명' 표기가 남아 있거나 지어낸 체험담입니다. 실제 사례로 바꾸거나 예시임을 문단 첫머리에 분명히 적어주세요.",
    severity: "high",
    re: /(\(예시\)|\(가명\)|예시입니다|가상의 (고객|인물|사례)|[가-힣]{2,3}\s?\(\d{2}대\))/g,
  },
  {
    key: "guarantee",
    label: "보장·확정 표현",
    advice:
      "'보장·확실히·무조건·100%' 같은 단정은 근거와 조건을 함께 적거나 '경우에 따라' 수준으로 낮춰주세요.",
    severity: "high",
    re: /(보장(합니다|해 드립니다|됩니다|돼요)|100\s?%|무조건|확실히 (효과|수익|성공)|실패 ?없(이|는))/g,
  },
  {
    key: "finance",
    label: "투자·수익 주장",
    advice:
      "원금 보호·수익률·수익 약속은 금융 광고 정책 대상입니다. 실제 조건·위험 고지를 함께 쓰거나 표현을 삭제하세요.",
    severity: "high",
    re: /(원금\s?보(장|호)|수익률\s?\d+\s?%|월\s?\d+만\s?원\s?(수익|벌)|고수익|확정 ?수익|무위험)/g,
  },
  {
    key: "health",
    label: "건강·효능 주장",
    advice:
      "다이어트·치료·완치·부작용 없음 같은 효능 단정은 근거(출처)가 필요합니다. 개인차·전문가 상담 안내를 넣거나 표현을 완화하세요.",
    severity: "high",
    re: /(\d+\s?kg\s?(감량|빠)|다이어트 ?효과|완치|치료 ?효과|부작용(이|은)? ?없|면역력 ?(강화|향상)|체중이 ?줄)/g,
  },
  {
    key: "certification",
    label: "인증·수상 주장",
    advice:
      "'인증·특허·1위·수상'은 기관명·번호·연도 등 확인 가능한 근거를 함께 적어주세요. 근거가 없으면 삭제하세요.",
    severity: "medium",
    re: /((KC|CE|FCC|FDA|ISO|KS)\s?인증|국제 ?인증|특허 ?(출원|등록)|\d+개국 ?인증|판매 ?1위|업계 ?1위|수상)/g,
  },
  {
    key: "stats",
    label: "출처 없는 수치·통계",
    advice:
      "'~%가', '평균 N배' 같은 통계는 출처가 없으면 빼거나 '저희 매장에서는' 처럼 관찰 범위를 한정하세요.",
    severity: "medium",
    re: /(\d{2,3}\s?%\s?(가|이|의|는|은)|평균\s?\d+(배|%)|\d+배\s?(증가|상승|향상))/g,
  },
  {
    key: "superlative",
    label: "최고·유일 표현",
    advice: "'최고·유일·최초·압도적' 같은 비교 우위 주장은 근거가 없으면 구체적인 사실로 바꿔주세요.",
    severity: "medium",
    re: /(최고의|유일한|국내 ?최초|압도적|타 ?(업체|서비스)보다)/g,
  },
];

/** HTML/마크다운을 거칠게 평문화(태그 제거). */
export function toPlainText(content: string): string {
  return (content ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[#*_>`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 본문에서 위험 신호를 찾는다(없으면 빈 배열). */
export function scanAdRisk(content: string): AdRiskSignal[] {
  const text = toPlainText(content);
  const out: AdRiskSignal[] = [];
  for (const rule of RULES) {
    const set = new Set<string>();
    for (const m of text.matchAll(rule.re)) {
      const v = m[0].trim();
      if (v) set.add(v);
      if (set.size >= 5) break;
    }
    if (set.size > 0)
      out.push({
        key: rule.key,
        label: rule.label,
        advice: rule.advice,
        matches: [...set],
        severity: rule.severity,
      });
  }
  return out;
}

/** 짧은 글(빈약한 콘텐츠) 여부 — 공백 제외 글자 수 기준. */
export function isThinContent(content: string, minChars = 600): boolean {
  return toPlainText(content).replace(/\s/g, "").length < minChars;
}
