/**
 * 디자이너 스튜디오 + 템플릿 마켓 플래그.
 * 기본 비활성 — 1단계는 플래그 뒤에서만 노출되어 기존 서비스에 영향 없음.
 * 운영 준비 후 NEXT_PUBLIC_MARKETPLACE_ENABLED=true 로 켠다.
 * (서버·클라이언트 공용으로 읽을 수 있게 NEXT_PUBLIC 사용)
 */
export const MARKETPLACE_ENABLED =
  process.env.NEXT_PUBLIC_MARKETPLACE_ENABLED === "true";

/** Page Schema 안전 한도 — 검증기와 에디터가 공유. */
export const SCHEMA_LIMITS = {
  maxSections: 40,
  maxRowsPerSection: 30,
  maxColumnsPerRow: 6,
  maxComponentsPerColumn: 30,
  maxTextLength: 8000,
  gridSpan: 12, // 컬럼 그리드 기준(1~12)
} as const;
