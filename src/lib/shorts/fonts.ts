/**
 * 캔버스용 폰트 해석 — next/font 가 만든 CSS 변수(var(--font-…))는 canvas `ctx.font` 에서
 * 못 쓰므로, 숨김 프로브 엘리먼트로 브라우저가 치환한 실제 패밀리명('__Nanum_Gothic_xxxx')을 얻는다.
 * 한글 구글 폰트는 unicode-range 슬라이스로 쪼개져 있어 `document.fonts.load(spec, text)` 에
 * 실제로 그릴 텍스트를 넘겨야 필요한 한글 슬라이스가 로드된다(안 넘기면 첫 슬라이스만).
 * 브라우저 전용(클라이언트 컴포넌트에서 호출).
 */
import { CARD_FONTS, cardFontStack } from "@/components/cards/cardTheme";
import type { CardFontId } from "@/types/domain";

const FALLBACK_FAMILY = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

/** CSS font-family 스택 → 캔버스에서 바로 쓸 수 있는 패밀리 문자열. */
export function resolveCanvasFontFamily(stack: string): string {
  if (typeof document === "undefined") return FALLBACK_FAMILY;
  try {
    const el = document.createElement("span");
    el.style.fontFamily = stack;
    el.style.position = "absolute";
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none";
    el.textContent = "가";
    document.body.appendChild(el);
    const fam = getComputedStyle(el).fontFamily;
    el.remove();
    return fam && fam.trim() ? fam : FALLBACK_FAMILY;
  } catch {
    return FALLBACK_FAMILY;
  }
}

/** 지정 굵기·크기로 폰트(해당 텍스트의 글리프 슬라이스 포함)를 로드한다. 최대 4초 대기. */
export async function ensureCanvasFont(
  weight: number,
  sizePx: number,
  family: string,
  sampleText: string,
): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const spec = `${weight} ${sizePx}px ${family}`;
  const text = sampleText && sampleText.trim() ? sampleText : "가나다 ABC 123";
  try {
    await Promise.race([
      document.fonts.load(spec, text),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch {
    /* 로드 실패 시 폴백 폰트로 그린다 */
  }
}

/** 굵기 1종(400)만 제공되는 디스플레이 폰트 — 700을 요청하면 합성 볼드가 되므로 400으로. */
const WEIGHT_BY_ID: Partial<Record<CardFontId, number>> = {
  jua: 400,
  "black-han": 400,
};

/** 카드뉴스 폰트 id → 캔버스 패밀리 + 굵기. */
export function canvasFontForCard(fontId: CardFontId | string | undefined): {
  family: string;
  weight: number;
} {
  const id = (CARD_FONTS.some((f) => f.id === fontId) ? fontId : "nanum-gothic") as CardFontId;
  return {
    family: resolveCanvasFontFamily(cardFontStack(id)),
    weight: WEIGHT_BY_ID[id] ?? 700,
  };
}
