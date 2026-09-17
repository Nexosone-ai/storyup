/**
 * 사업자 정보 — PG/카드사 심사에 필요한 표기 항목.
 * 실제 값 확인 후 채워 넣으세요. 비어 있는 항목은 푸터에 표시되지 않습니다.
 * (허위 정보 기재 금지 — 사업자등록 정보와 정확히 일치해야 합니다.)
 */
export const COMPANY = {
  name: "주식회사 넥서스원",
  representative: "김동혁",
  businessNumber: "645-81-03885",
  mailOrderNumber: "2026-부산중구-0161", // 통신판매업 신고번호 (2026-09-16 발급)
  address: "부산광역시 중구 해관로 64, 403-제이2호(중앙동4가)",
  supportEmail: "", // 고객 지원 이메일 (확정 후 기재)
  supportPhone: "070-5100-4329",
} as const;

/**
 * 계좌이체 입금 계좌 — PG 정식 오픈 전 수동 결제 안내에 표시된다.
 * 사업자 계좌 정보와 정확히 일치해야 하며, 값을 채우면 즉시 반영된다.
 */
export const BANK_ACCOUNT = {
  bank: "IBK기업은행",
  number: "092-124380-04-015",
  holder: "주식회사 넥서스원",
} as const;

export const bankAccountConfigured = () =>
  !!BANK_ACCOUNT.bank && !!BANK_ACCOUNT.number && !!BANK_ACCOUNT.holder;

export const companyInfoRows = () =>
  [
    ["", COMPANY.name],
    ["대표", COMPANY.representative],
    ["사업자등록번호", COMPANY.businessNumber],
    ["통신판매업신고", COMPANY.mailOrderNumber],
    ["주소", COMPANY.address],
    ["고객센터", [COMPANY.supportEmail, COMPANY.supportPhone].filter(Boolean).join(" · ")],
  ].filter(([, v]) => !!v) as [string, string][];
