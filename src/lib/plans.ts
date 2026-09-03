/**
 * 요금제 정의 — 단일 소스(2026-09-02 확정 스펙).
 * 월 제공량은 구독에 기본 포함되며, 초과 생성 시 OVERAGE_COST 포인트가 차감된다.
 * 1P = ₩1, 미사용 포인트는 이월, 구독은 자동 갱신.
 */

export type PlanId = "free" | "basic" | "pro" | "partner";

export interface Plan {
  id: PlanId;
  name: { ko: string; en: string };
  /** 월 가격(원). null = 별도 협의 */
  priceKrw: number | null;
  /** 월 제공 포인트. null = 대량 제공(협의) */
  monthlyPoints: number | null;
  limits: {
    /** AI 홈페이지 (누적 보유 개수). null = 협의 */
    sites: number | null;
    /** 블로그 생성 건/월. null = 협의 */
    blogPosts: number | null;
    /** SNS 카드뉴스(6매) 건/월. null = 협의 */
    cardNews: number | null;
    /** AI 이미지 개/월. null = 협의, 0 = 무료 모델만(비-Gemini) */
    aiImages: number | null;
  };
  customDomain: boolean;
  watermarkRemoved: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: { ko: "Free", en: "Free" },
    priceKrw: 0,
    monthlyPoints: 100,
    limits: { sites: 1, blogPosts: 10, cardNews: 3, aiImages: 0 },
    customDomain: false,
    watermarkRemoved: false,
  },
  {
    id: "basic",
    name: { ko: "Basic", en: "Basic" },
    priceKrw: 9900,
    monthlyPoints: 1000,
    limits: { sites: 3, blogPosts: 30, cardNews: 30, aiImages: 40 },
    customDomain: true,
    watermarkRemoved: true,
  },
  {
    id: "pro",
    name: { ko: "Pro", en: "Pro" },
    priceKrw: 29000,
    monthlyPoints: 5000,
    limits: { sites: 5, blogPosts: 90, cardNews: 100, aiImages: 70 },
    customDomain: true,
    watermarkRemoved: true,
  },
  {
    id: "partner",
    name: { ko: "Partner", en: "Partner" },
    priceKrw: null,
    monthlyPoints: null,
    limits: { sites: null, blogPosts: null, cardNews: null, aiImages: null },
    customDomain: true,
    watermarkRemoved: true,
  },
];

/** 월 제공량 초과 시 건당 차감 포인트 (1P = ₩1). */
export const OVERAGE_COST = {
  site: 3000,
  blogPost: 1000,
  cardNews: 1000,
  aiImage: 100,
} as const;

/** 카드뉴스 1건당 이미지 매수. */
export const CARD_NEWS_PAGES = 6;
