import type { CSSProperties } from "react";
import type {
  WebsiteContent,
  WebsiteFontId,
  WebsitePaletteId,
} from "@/types/domain";

/** Preset accent palettes for published sites (applied over the light theme). */
export const SITE_PALETTES: Array<{
  id: WebsitePaletteId;
  name: string;
  nameEn: string;
  primary: string;
  hover: string;
  soft: string;
}> = [
  { id: "forest", name: "포레스트 그린", nameEn: "Forest Green", primary: "#1f6f5a", hover: "#195a49", soft: "#e7f0ec" },
  { id: "ocean", name: "오션 블루", nameEn: "Ocean Blue", primary: "#1e5f9e", hover: "#174e84", soft: "#e5eef7" },
  { id: "plum", name: "딥 플럼", nameEn: "Deep Plum", primary: "#6b4b8a", hover: "#593e74", soft: "#efe9f5" },
  { id: "terracotta", name: "테라코타", nameEn: "Terracotta", primary: "#b85c38", hover: "#9c4c2e", soft: "#f7eae4" },
  { id: "rose", name: "로즈", nameEn: "Rose", primary: "#b0446a", hover: "#953a5a", soft: "#f8e9ef" },
  { id: "charcoal", name: "차콜", nameEn: "Charcoal", primary: "#3a3f47", hover: "#2d3138", soft: "#ebedef" },
];

/** Preset font choices. Stacks reference variables loaded in the root layout. */
export const SITE_FONTS: Array<{
  id: WebsiteFontId;
  name: string;
  nameEn: string;
  /** null = keep the theme default stack. */
  stack: string | null;
}> = [
  { id: "default", name: "기본", nameEn: "Default", stack: null },
  {
    id: "noto-sans",
    name: "모던 고딕",
    nameEn: "Modern Sans",
    stack:
      'var(--font-noto-sans-kr), "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  },
  {
    id: "serif",
    name: "클래식 명조",
    nameEn: "Classic Serif",
    stack: 'var(--font-noto-serif-kr), "Nanum Myeongjo", Georgia, serif',
  },
  {
    id: "gowun",
    name: "고운 돋움",
    nameEn: "Gowun Dodum",
    stack:
      'var(--font-gowun-dodum), "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  },
];

/**
 * CSS variable overrides for a site's chosen palette/font. Spread onto the
 * wrapper that carries `theme-editorial-light` — inline custom properties win
 * over the class, and `--ring` (color-mix on --primary) follows automatically.
 */
export function siteStyleVars(style: WebsiteContent["style"]): CSSProperties {
  const vars: Record<string, string> = {};

  const palette = SITE_PALETTES.find((p) => p.id === style?.palette);
  if (palette && palette.id !== "forest") {
    vars["--primary"] = palette.primary;
    vars["--primary-hover"] = palette.hover;
    vars["--primary-soft"] = palette.soft;
  }

  const font = SITE_FONTS.find((f) => f.id === style?.font);
  if (font?.stack) {
    vars["--font-sans"] = font.stack;
    vars.fontFamily = "var(--font-sans)";
  }

  return vars as CSSProperties;
}
