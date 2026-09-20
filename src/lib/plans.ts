/**
 * 요금제 정의 — 단일 소스(2026-09-20 스펙).
 * 월 제공량은 구독에 기본 포함되며, 초과 생성 시 관리자 화면(service_prices)의
 * 서비스 단가가 포인트로 차감된다. (초과 단가 = AI 서비스 가격 단일 소스)
 * 1P = ₩1, 미사용 포인트는 이월, 구독은 자동 갱신.
 */

export type PlanId = "free" | "basic" | "pro" | "partner";

export interface Plan {
  id: PlanId;
  name: { ko: string; en: string };
  /** 월 가격(원). null = 별도 협의 */
  priceKrw: number | null;
  limits: {
    /** AI 랜딩페이지 (누적 보유 개수). null = 협의 */
    sites: number | null;
    /** 블로그 생성 건/월. null = 협의 */
    blogPosts: number | null;
    /** SNS 카드뉴스(6매) 건/월. null = 협의 */
    cardNews: number | null;
    /** AI 이미지 개/월. null = 협의, 0 = 무료 모델만(비-Gemini) */
    aiImages: number | null;
  };
  /** 랜딩페이지에서 선택 가능한 레이아웃 수. 미지정 시 카드에 표기하지 않는다. */
  siteLayouts?: number;
  /** 도메인 지원 형태. 미지정 = 미지원, "subdomain" = storyup.me 하위 경로, "custom" = 외부 자체 도메인 연결 */
  domain?: "subdomain" | "custom";
  watermarkRemoved: boolean;
  /** 블로그 하단 쿠폰 발행 기능 */
  couponBlock?: boolean;
  /** 사용 분석 기반 AI 전략 수립 */
  aiStrategy?: boolean;
  /** SEO 최적화 기능 */
  seoTools?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: { ko: "Free", en: "Free" },
    priceKrw: 0,
    limits: { sites: 1, blogPosts: 10, cardNews: 1, aiImages: 0 },
    watermarkRemoved: false,
  },
  {
    id: "basic",
    name: { ko: "Basic", en: "Basic" },
    priceKrw: 29000,
    limits: { sites: 3, blogPosts: 30, cardNews: 3, aiImages: 50 },
    siteLayouts: 3,
    domain: "subdomain",
    watermarkRemoved: true,
  },
  {
    id: "pro",
    name: { ko: "Pro", en: "Pro" },
    priceKrw: 49000,
    limits: { sites: 5, blogPosts: 90, cardNews: 9, aiImages: 90 },
    siteLayouts: 9,
    domain: "custom",
    watermarkRemoved: true,
    couponBlock: true,
    aiStrategy: true,
    seoTools: true,
  },
  {
    id: "partner",
    name: { ko: "Partner", en: "Partner" },
    priceKrw: null,
    limits: { sites: null, blogPosts: null, cardNews: null, aiImages: null },
    domain: "custom",
    watermarkRemoved: true,
    couponBlock: true,
    aiStrategy: true,
    seoTools: true,
  },
];

const PLAN_BY_ID = new Map(PLANS.map((p) => [p.id, p]));

export function getPlanById(id: PlanId): Plan {
  return PLAN_BY_ID.get(id) ?? PLANS[0];
}

/** 카드뉴스 1건당 이미지 매수. */
export const CARD_NEWS_PAGES = 6;

/**
 * 요금제 카드/목록에 노출할 기능 불릿 — 마케팅 요금제 페이지와 대시보드가 공유한다.
 * (UP 제공량은 카드에 표기하지 않는다. 사용량·잔액은 포인트 화면에서 확인.)
 */
export function planFeatureList(plan: Plan, ko: boolean): string[] {
  const l = plan.limits;
  // 무료 플랜의 블로그·카드뉴스는 월 갱신이 아닌 총 제공량이라 "/월"을 붙이지 않는다.
  const oneTime = plan.priceKrw === 0;
  const per = oneTime ? (ko ? "건" : "") : ko ? "건/월" : "/mo";
  const talk = ko ? "협의" : "Custom";
  const out: string[] = [ko ? "브랜드 스토리 생성" : "Brand story generation"];

  // AI 랜딩페이지 (+ 레이아웃 수)
  if (l.sites === null) {
    out.push(ko ? `AI 랜딩페이지 ${talk}` : `AI landing pages: ${talk}`);
  } else {
    const layout =
      plan.siteLayouts != null
        ? ko
          ? ` (레이아웃 ${plan.siteLayouts}개)`
          : ` (${plan.siteLayouts} layouts)`
        : "";
    out.push(
      ko
        ? `AI 랜딩페이지 ${l.sites}개${layout}`
        : `${l.sites} AI landing page${l.sites > 1 ? "s" : ""}${layout}`,
    );
  }

  // 블로그 생성
  out.push(
    l.blogPosts === null
      ? ko
        ? `블로그 생성 ${talk}`
        : `Blog posts: ${talk}`
      : ko
        ? `블로그 생성 ${l.blogPosts}${per}`
        : `${l.blogPosts} blog posts${per}`,
  );

  // SNS 카드뉴스
  out.push(
    l.cardNews === null
      ? ko
        ? `SNS 카드뉴스 ${talk}`
        : `Card news: ${talk}`
      : ko
        ? `SNS 카드뉴스(${CARD_NEWS_PAGES}매) ${l.cardNews}${per}`
        : `${l.cardNews} card news (${CARD_NEWS_PAGES} pages)${per}`,
  );

  // AI 이미지
  out.push(
    l.aiImages === null
      ? ko
        ? `AI 이미지 ${talk}`
        : `AI images: ${talk}`
      : l.aiImages === 0
        ? ko
          ? "무료 이미지 모델 제공"
          : "Free image model included"
        : ko
          ? `AI 이미지 ${l.aiImages}개/월`
          : `${l.aiImages} AI images/mo`,
  );

  // 도메인
  if (plan.domain === "subdomain") {
    out.push(
      ko
        ? "STORYUP 자체 도메인(storyup.me/내도메인)"
        : "STORYUP subdomain (storyup.me/you)",
    );
  } else if (plan.domain === "custom") {
    out.push(
      ko
        ? "자체 도메인 연결 지원(도메인 구매 별도)"
        : "Custom domain support (domain sold separately)",
    );
  }

  if (plan.watermarkRemoved)
    out.push(ko ? "STORYUP 워터마크 제거" : "No STORYUP watermark");
  if (plan.couponBlock)
    out.push(ko ? "블로그 하단 쿠폰 발행 기능" : "Coupon block under blog posts");
  if (plan.aiStrategy)
    out.push(
      ko ? "사용 분석 기반 AI 전략 수립" : "AI strategy from usage analytics",
    );
  if (plan.seoTools) out.push(ko ? "SEO 최적화 기능" : "SEO optimization");

  return out;
}
