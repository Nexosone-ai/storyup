/** 업종 요약 뷰 + 라벨 헬퍼 — 클라이언트/서버 공용(‘server-only’ 아님). */

export interface IndustrySummary {
  id: string;
  slug: string;
  nameKo: string;
  nameEn: string;
  icon: string;
  summaryKo: string;
  summaryEn: string;
  sensitive: boolean;
}

export function industryName(s: IndustrySummary, ko: boolean): string {
  return ko ? s.nameKo : s.nameEn;
}

export function industrySummaryText(s: IndustrySummary, ko: boolean): string {
  return ko ? s.summaryKo : s.summaryEn;
}
