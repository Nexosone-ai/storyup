// Explicit hex values (mirrors globals.css tokens) so html-to-image export
// resolves colors reliably regardless of CSS-variable inheritance.
import type { CardFontId } from "@/types/domain";

export const CARD = {
  paper: "#fbfaf8",
  surface: "#ffffff",
  ink: "#1b1a17",
  muted: "#726d64",
  border: "#e9e5dd",
  borderStrong: "#d9d4c9",
  primary: "#1f6f5a",
  primarySoft: "#e7f0ec",
  onPrimary: "#ffffff",
  font: '"Geist", "Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif',
  mono: '"Geist Mono", ui-monospace, monospace',
} as const;

export const IG = { w: 1080, h: 1350 } as const;

// 공통 한글 폴백 — 웹폰트 미로딩 시에도 한글이 깨지지 않게.
const KO_FALLBACK = '"Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif';

/**
 * 카드뉴스 폰트 선택지. stack은 루트 레이아웃(layout.tsx)에서 next/font로
 * self-host된 CSS 변수를 참조한다 — 같은 출처라 html-to-image PNG 내보내기에서도
 * 폰트가 그대로 embed된다. 'default'는 기존 스택(Pretendard 계열)을 유지한다.
 */
export const CARD_FONTS: Array<{
  id: CardFontId;
  name: string;
  nameEn: string;
  stack: string;
}> = [
  { id: "default", name: "기본 (프리텐다드)", nameEn: "Default", stack: CARD.font },
  {
    id: "nanum-gothic",
    name: "나눔고딕",
    nameEn: "Nanum Gothic",
    stack: `var(--font-nanum-gothic), ${KO_FALLBACK}`,
  },
  {
    id: "nanum-myeongjo",
    name: "나눔명조",
    nameEn: "Nanum Myeongjo",
    stack: `var(--font-nanum-myeongjo), "Nanum Myeongjo", serif`,
  },
  {
    id: "gowun",
    name: "고운돋움",
    nameEn: "Gowun Dodum",
    stack: `var(--font-gowun-dodum), ${KO_FALLBACK}`,
  },
  {
    id: "black-han",
    name: "검은고딕 (임팩트)",
    nameEn: "Black Han Sans",
    stack: `var(--font-black-han-sans), ${KO_FALLBACK}`,
  },
  {
    id: "jua",
    name: "주아 (동글)",
    nameEn: "Jua",
    stack: `var(--font-jua), ${KO_FALLBACK}`,
  },
];

/** 폰트 id → CSS font-family 스택. 없으면 기본 스택. */
export function cardFontStack(id: CardFontId | undefined): string {
  return (CARD_FONTS.find((f) => f.id === id) ?? CARD_FONTS[0]).stack;
}
