/**
 * 사업자 정보 — PG/카드사 심사에 필요한 표기 항목.
 * 실제 값 확인 후 채워 넣으세요. 비어 있는 항목은 푸터에 표시되지 않습니다.
 * (허위 정보 기재 금지 — 사업자등록 정보와 정확히 일치해야 합니다.)
 */
export const COMPANY = {
  name: "", // 예: 넥소스원 주식회사
  representative: "", // 대표자명
  businessNumber: "", // 사업자등록번호 (예: 000-00-00000)
  mailOrderNumber: "", // 통신판매업 신고번호 (예: 제0000-서울강남-00000호)
  address: "", // 사업장 주소
  supportEmail: "", // 고객 지원 이메일
  supportPhone: "", // 고객 지원 전화
} as const;

export const companyInfoRows = () =>
  [
    ["상호", COMPANY.name],
    ["대표", COMPANY.representative],
    ["사업자등록번호", COMPANY.businessNumber],
    ["통신판매업신고", COMPANY.mailOrderNumber],
    ["주소", COMPANY.address],
    ["고객지원", [COMPANY.supportEmail, COMPANY.supportPhone].filter(Boolean).join(" · ")],
  ].filter(([, v]) => !!v) as [string, string][];
