/**
 * 자유형 Page Schema — 디자이너가 비주얼 빌더로 자유롭게 구성하되,
 * 산출물은 '검증된 JSON 스키마 + 디자인 토큰'일 뿐 임의 코드가 아니다(안전 실행).
 *
 * 구조: page → sections → rows → columns → components.
 * 레이아웃은 토큰/열거값으로 제한하고, 반응형은 base/mobile/tablet/desktop 오버라이드.
 * 콘텐츠(필드)와 디자인 표현은 분리한다(component.slot = 콘텐츠 슬롯 키).
 */

export type Device = "mobile" | "tablet" | "desktop";

/** base 값 + 기기별 부분 오버라이드. */
export interface Responsive<T> {
  base: T;
  mobile?: Partial<T>;
  tablet?: Partial<T>;
  desktop?: Partial<T>;
}

export type AlignX = "start" | "center" | "end" | "stretch";
export type JustifyX = "start" | "center" | "end" | "between" | "around";
export type SpaceToken = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;

/** 레이아웃 속성 — CSS를 직접 받지 않고 제한된 토큰/열거값만 받는다. */
export interface LayoutProps {
  align?: AlignX;
  justify?: JustifyX;
  gap?: SpaceToken;
  paddingX?: SpaceToken;
  paddingY?: SpaceToken;
  /** 디자인 토큰 색상 키(tokens.colors) 또는 "transparent". */
  background?: string;
  /** 섹션 내용 최대 폭(px). 없으면 전체 폭. */
  maxWidth?: number;
}

// ---- 컴포넌트(승인된 타입만) ----

export type ButtonStyle = "primary" | "outline" | "ghost";

export type ComponentNode =
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string; slot?: string; color?: string }
  | { type: "text"; html: string; slot?: string } // 인라인 리치텍스트(새니타이즈 대상)
  | { type: "image"; src: string; alt: string; ratio?: "16:9" | "4:3" | "1:1" | "3:4"; slot?: string }
  | { type: "button"; label: string; href?: string; style?: ButtonStyle; slot?: string }
  | { type: "list"; ordered?: boolean; items: string[]; slot?: string }
  | { type: "card"; title?: string; body?: string; image?: string; slot?: string }
  | { type: "spacer"; size: SpaceToken }
  | { type: "divider" };

export type ComponentType = ComponentNode["type"];

export const ALLOWED_COMPONENT_TYPES: ComponentType[] = [
  "heading",
  "text",
  "image",
  "button",
  "list",
  "card",
  "spacer",
  "divider",
];

export interface Column {
  /** 12 그리드 기준 폭(1~12). 합이 12를 넘으면 자동 줄바꿈. */
  span: number;
  components: ComponentNode[];
  layout?: LayoutProps;
}

export interface Row {
  columns: Column[];
  layout?: LayoutProps;
}

export interface Section {
  /** 안정적 식별자(복제·순서변경·콘텐츠 매핑에 사용). */
  id: string;
  rows: Row[];
  layout?: Responsive<LayoutProps>;
}

/** 디자인 토큰 — 색/폰트/라운드/간격. 색상은 검증된 값만. */
export interface DesignTokens {
  /** 토큰 키 → 색상값(#hex 또는 rgb/rgba). 레이아웃·컴포넌트가 키로 참조. */
  colors: Record<string, string>;
  /** 허용된 폰트 패밀리 id(siteStyle의 폰트 토큰과 호환). */
  fontFamily?: string;
  /** 모서리 라운드(px). */
  radius?: number;
  /** 기준 간격 단위(px). SpaceToken × 이 값. */
  spacingUnit?: number;
}

export interface PageSchema {
  version: 1;
  tokens: DesignTokens;
  sections: Section[];
}

/** 콘텐츠 슬롯 정의 — 템플릿이 노출하는 편집 가능 필드(콘텐츠/디자인 분리). */
export interface ContentSlot {
  key: string;
  label: string;
  kind: "text" | "richtext" | "image" | "url";
  required?: boolean;
}

export const emptyPageSchema = (): PageSchema => ({
  version: 1,
  tokens: { colors: { primary: "#4f46e5", bg: "#ffffff", text: "#111827" } },
  sections: [],
});
