import { B2B2C_ENABLED } from "@/lib/b2b2c/config";

/**
 * 한도 초과·플랜 미제공 안내의 단일 진입점.
 *
 * B2B2C(파트너 중개 판매) 모드에서는 고객이 직접 플랜을 바꾸지 않는다 — 기본 상품(Basic)은
 * 파트너가 공급하고, 추가 이용(블로그·카드뉴스·영상·이미지 추가, Pro 전환)은 **담당 파트너에게
 * 문의**해 파트너가 견적·대행(업세일)한다. 그래서 모든 "업그레이드" 문구·링크는 이 모듈을 거쳐
 * 서포터즈(대행 문의) 화면으로 보낸다. 플래그가 꺼진 B2C 모드에서는 기존 플랜 화면으로 간다.
 *
 * 서버·클라이언트 공용(순수 함수).
 */

/** 대행 문의(agency_services.key) — 0104 시드. 파트너 업세일 메뉴. */
export const UPSELL_SERVICE = {
  EXTRA_BLOG: "EXTRA_BLOG",
  EXTRA_CARDNEWS: "EXTRA_CARDNEWS",
  SHORTS_NARRATION: "SHORTS_NARRATION",
  AI_VIDEO: "AI_VIDEO",
  EXTRA_IMAGES: "EXTRA_IMAGES",
  PLAN_UPGRADE: "PLAN_UPGRADE",
} as const;
export type UpsellService = (typeof UPSELL_SERVICE)[keyof typeof UPSELL_SERVICE];

/** 안내 링크 — B2B2C: 서포터즈(담당 파트너 문의, 분야 프리셋) / B2C: 플랜 화면. */
export function upsellHref(service?: UpsellService): string {
  if (!B2B2C_ENABLED) return "/dashboard/plans";
  return service ? `/dashboard/supporters?service=${service}` : "/dashboard/supporters";
}

/** 문장 꼬리 — "… 플랜을 업그레이드해주세요." 자리에 쓴다. */
export function upsellSentence(ko: boolean): string {
  if (B2B2C_ENABLED)
    return ko
      ? "추가 이용은 담당 파트너에게 문의해주세요."
      : "Contact your partner to add more.";
  return ko ? "플랜을 업그레이드해주세요." : "Please upgrade your plan.";
}

/** 버튼 라벨. */
export function upsellCtaLabel(ko: boolean): string {
  if (B2B2C_ENABLED) return ko ? "담당 파트너에게 문의" : "Contact my partner";
  return ko ? "플랜 보기" : "View plans";
}
