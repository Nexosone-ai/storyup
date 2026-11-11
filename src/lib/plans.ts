/**
 * 요금제 정의 — 단일 소스(2026-09-20 스펙).
 * 월 제공량은 구독에 기본 포함되며, 초과 생성 시 관리자 화면(service_prices)의
 * 서비스 단가가 포인트로 차감된다. (초과 단가 = AI 서비스 가격 단일 소스)
 * 1P = ₩1, 미사용 포인트는 이월, 구독은 자동 갱신.
 */

import { SHORTS_ENABLED } from "@/lib/shorts/config";

export type PlanId = "free" | "basic" | "pro" | "partner" | "lite";

export interface Plan {
  id: PlanId;
  name: { ko: string; en: string };
  /** 월 가격(원, B2C 정가). null = 별도 협의 */
  priceKrw: number | null;
  /**
   * 파트너 공급가(원, 부가세 별도) — B2B2C 모드에서 본사가 파트너에게 공급하는 기준가.
   * 파트너는 이 위에 마진을 붙여 고객에게 판매(업세일). base_plan_catalog 행이 없을 때의 기본값.
   */
  partnerSupplyPriceKrw?: number;
  limits: {
    /** AI 랜딩페이지 (누적 보유 개수). null = 협의 */
    sites: number | null;
    /** 블로그 생성 건/월. null = 협의 */
    blogPosts: number | null;
    /** SNS 카드뉴스(6매) 건/월. null = 협의 */
    cardNews: number | null;
    /** 쇼츠(카드뉴스 배경 9:16 영상) 생성 건/월. 0 = 미제공(Free), null = 협의(무제한) */
    shorts: number | null;
    /** AI 영상 생성 월 무료 편수. 0 = 미제공(Free), null = 협의(무제한) */
    video: number | null;
    /**
     * AI 이미지 월 한도(src/lib/ai/imageQuota.ts가 모든 플랜에 적용 — Free 30 · Basic 100 · Pro 300).
     * 초과 시 생성이 막히고 B2B2C 모드에선 담당 파트너 문의 안내. null = 무제한(Partner).
     */
    aiImages: number | null;
  };
  /**
   * 고화질 AI 이미지(Gemini). 미지정 = fal FLUX(장당 ~₩4, 기본 상품·무료).
   * 기본 상품 원가의 절반이 이미지라 Basic 은 fal 로 두고, 고화질은 Pro/파트너 및
   * '담당 파트너 문의(AI 이미지 추가)' 업세일로 제공한다. (src/lib/ai/image/index.ts)
   */
  premiumImages?: boolean;
  /** 관리 가능한 브랜드/사업장 최대 개수. null = 협의(무제한 취급) */
  maxBusinesses: number | null;
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
  /** 콘텐츠 예약 발행 (Pro 이상) */
  scheduledPublish?: boolean;
  /** 블로그 하단 예약(식당·매장) 모듈 (Pro 이상) */
  reservation?: boolean;
  /** AI 상세 홈페이지 생성 — 자료 입력 → 풍부한 섹션·컨셉 자동 구성 (Pro 이상) */
  fullHomepage?: boolean;
  /** 성과 리포트 제공 주기. 미지정 = 미제공, "monthly" = 월간, "weekly" = 주간+월간 */
  report?: "monthly" | "weekly";
  /** 방문자 분석 수준. "basic" = 핵심 지표, "detailed" = +유입·쿠폰·고객, "advanced" = +SEO 진단 */
  analyticsTier: "basic" | "detailed" | "advanced";
  /** AEO/GEO — 답변엔진 최적화(FAQ·FAQPage 구조화 데이터). Pro 이상. */
  aeo?: boolean;
  /** AI 비즈니스 에이전트(채팅·도구 실행·기억·오토파일럿). 대행 파트너 전용. */
  aiAgent?: boolean;
  /** 관리자/직원 총 계정 수(소유자 포함). null = 협의(무제한). 직원 초대 가능 수 = maxMembers-1. */
  maxMembers: number | null;
  /** 요금 안내·플랜 선택 화면에 비노출(파트너 전용 공급 플랜 등). */
  hidden?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: { ko: "Free", en: "Free" },
    priceKrw: 0,
    limits: { sites: 1, blogPosts: 30, cardNews: 0, shorts: 0, video: 0, aiImages: 30 }, // 블로그: 하루 1개·월 30개(월 재신청), 카드뉴스: 미제공(유료 전용), aiImages: 월 30장(fal)
    maxBusinesses: 1,
    maxMembers: 1,
    siteLayouts: 1,
    watermarkRemoved: false,
    analyticsTier: "basic",
  },
  {
    // 파트너 기본 상품(2026-11-09) — 파트너 공급가 ₩20,000(VAT 별도), 1계정 1사업장.
    // 한도를 넘는 이용(블로그·카드뉴스·영상·이미지 추가, Pro 전환)은 담당 파트너 문의(업세일).
    id: "basic",
    name: { ko: "Basic", en: "Basic" },
    priceKrw: 59000,
    partnerSupplyPriceKrw: 20000,
    limits: { sites: 1, blogPosts: 20, cardNews: 5, shorts: 5, video: 0, aiImages: 100 },
    maxBusinesses: 1,
    maxMembers: 1,
    siteLayouts: 9,
    domain: "subdomain",
    watermarkRemoved: true,
    couponBlock: true,
    aiStrategy: true,
    seoTools: true,
    report: "monthly",
    analyticsTier: "detailed",
  },
  {
    id: "pro",
    name: { ko: "Pro", en: "Pro" },
    priceKrw: 119000,
    // 랜딩페이지 1개(2026-11-11, 원가 재산정) — 기존 Pro 구독자는 만기까지 legacyPlanFor(사이트 6개) 유지.
    limits: { sites: 1, blogPosts: 300, cardNews: 90, shorts: 90, video: 10, aiImages: 300 },
    maxBusinesses: 6,
    maxMembers: 3,
    siteLayouts: 9,
    domain: "custom",
    watermarkRemoved: true,
    couponBlock: true,
    aiStrategy: true,
    seoTools: true,
    scheduledPublish: true,
    reservation: true,
    fullHomepage: true,
    report: "weekly",
    analyticsTier: "advanced",
    aeo: true,
    premiumImages: true,
  },
  {
    // 파트너 직접 생성 계정(별도계약, 2026-11-10) — B2C 미판매. 별도계약 파트너가 고객 계정을 직접 만들고
    // 30일 이용권당 패킷(LITE_ACCOUNT_30D, 기본 118 = ₩11,800 VAT 별도)을 차감한다. src/lib/partner/provisioning.ts
    id: "lite",
    name: { ko: "Lite", en: "Lite" },
    priceKrw: null,
    partnerSupplyPriceKrw: 11800,
    limits: { sites: 1, blogPosts: 10, cardNews: 6, shorts: 3, video: 0, aiImages: 50 },
    maxBusinesses: 1,
    maxMembers: 1,
    siteLayouts: 9,
    domain: "subdomain",
    watermarkRemoved: true,
    couponBlock: true,
    aiStrategy: true,
    seoTools: true,
    report: "monthly",
    analyticsTier: "detailed",
    hidden: true,
  },
  {
    id: "partner",
    name: { ko: "Partner", en: "Partner" },
    priceKrw: null,
    limits: { sites: null, blogPosts: null, cardNews: null, shorts: null, video: null, aiImages: null },
    maxBusinesses: null,
    maxMembers: null,
    domain: "custom",
    premiumImages: true,
    watermarkRemoved: true,
    couponBlock: true,
    aiStrategy: true,
    seoTools: true,
    scheduledPublish: true,
    reservation: true,
    fullHomepage: true,
    report: "weekly",
    analyticsTier: "advanced",
    aeo: true,
    aiAgent: true,
  },
];

const PLAN_BY_ID = new Map(PLANS.map((p) => [p.id, p]));

/** 요금 안내·플랜 선택에 노출하는 플랜(파트너 전용 공급 플랜 제외). */
export const PUBLIC_PLANS: Plan[] = PLANS.filter((p) => !p.hidden);

/** 이 플랜의 AI 이미지를 고화질(Gemini)로 만들지. false = fal FLUX(저원가). */
export function premiumImagesFor(plan: PlanId | Plan): boolean {
  const p = typeof plan === "string" ? getPlanById(plan) : plan;
  return p.premiumImages === true;
}

/**
 * 플랜 조건 전환일(2026-11-09, 파트너 기본 상품 재정의). 이 시각 이전에 시작해 아직 만기가
 * 지나지 않은 Basic·Pro 구독은 만기까지 아래 '이전 조건'을 유지한다(subscription.ts getUserPlan).
 * 갱신·재결제로 새 기간이 시작되면 현행 조건이 적용된다.
 */
export const PLAN_TERMS_CUTOVER_ISO = "2026-11-09T00:00:00+09:00";

/** 전환 전 Basic·Pro 조건(한도·사업장·레이아웃·고화질 이미지). 이미지 한도는 당시 미적용이라 무제한. */
const LEGACY_PLAN_OVERRIDES: Partial<Record<PlanId, Partial<Plan>>> = {
  basic: {
    limits: { sites: 3, blogPosts: 100, cardNews: 30, shorts: 30, video: 8, aiImages: null },
    maxBusinesses: 3,
    siteLayouts: 3,
    premiumImages: true,
  },
  pro: {
    limits: { sites: 6, blogPosts: 300, cardNews: 90, shorts: 90, video: 10, aiImages: null },
  },
};

/** 전환 전 조건이 적용된 플랜 객체(id 는 동일). 이전 조건이 없는 플랜은 현행 그대로. */
export function legacyPlanFor(id: PlanId): Plan {
  const base = getPlanById(id);
  const o = LEGACY_PLAN_OVERRIDES[id];
  if (!o) return base;
  return { ...base, ...o, limits: { ...base.limits, ...(o.limits ?? {}) } };
}

export function getPlanById(id: PlanId): Plan {
  return PLAN_BY_ID.get(id) ?? PLANS[0];
}

/** 카드뉴스 1건당 이미지 매수. */
export const CARD_NEWS_PAGES = 6;

/** 랜딩페이지 레이아웃 총수 — siteLayouts 가 이 값 이상이면 "모두 사용"으로 표기. */
export const ALL_SITE_LAYOUTS = 9;

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
        ? plan.siteLayouts >= ALL_SITE_LAYOUTS
          ? ko
            ? " (레이아웃 모두 사용)"
            : " (all layouts)"
          : ko
            ? ` (레이아웃 ${plan.siteLayouts}개)`
            : ` (${plan.siteLayouts} layouts)`
        : "";
    out.push(
      ko
        ? `AI 랜딩페이지 ${l.sites}개${layout}`
        : `${l.sites} AI landing page${l.sites > 1 ? "s" : ""}${layout}`,
    );
  }

  // 블로그 생성 (무료는 하루 1개·월 30개 + 월 단위 재신청/관리자 승인)
  out.push(
    l.blogPosts === null
      ? ko
        ? `블로그 생성 ${talk}`
        : `Blog posts: ${talk}`
      : oneTime
        ? ko
          ? `블로그 생성 하루 1개·월 ${l.blogPosts}개 (재신청제)`
          : `Blog: 1/day, ${l.blogPosts}/mo (renewable)`
        : ko
          ? `블로그 생성 ${l.blogPosts}${per}`
          : `${l.blogPosts} blog posts${per}`,
  );

  // SNS 카드뉴스 — 0건(미제공, 유료 전용)은 카드에 표기하지 않는다.
  if (l.cardNews === null) {
    out.push(ko ? `SNS 카드뉴스 ${talk}` : `Card news: ${talk}`);
  } else if (l.cardNews > 0) {
    out.push(
      ko
        ? `SNS 카드뉴스(${CARD_NEWS_PAGES}매) ${l.cardNews}${per}`
        : `${l.cardNews} card news (${CARD_NEWS_PAGES} pages)${per}`,
    );
  }

  // 쇼츠(카드뉴스 배경 9:16 영상) — 제공 플랜만 표기. 비활성(준비중)이면 꼬리표.
  const shortsSoon = SHORTS_ENABLED ? "" : ko ? " (준비중)" : " (soon)";
  if (l.shorts === null) {
    out.push(ko ? `쇼츠 생성 ${talk}${shortsSoon}` : `Shorts: ${talk}${shortsSoon}`);
  } else if (l.shorts > 0) {
    out.push(
      ko
        ? `쇼츠 생성 ${l.shorts}${per}${shortsSoon}`
        : `${l.shorts} shorts${per}${shortsSoon}`,
    );
  }

  // AI 영상 — 생성 1편당 UP 포인트 차감(관리자 단가).
  if (l.video === null) {
    out.push(ko ? `AI 영상 ${talk}` : `AI video: ${talk}`);
  } else if (l.video > 0) {
    out.push(ko ? "AI 영상 생성 (UP 차감)" : "AI video (UP points)");
  }

  // AI 이미지 — 모든 플랜 월 한도 표기(Partner 는 협의).
  out.push(
    l.aiImages === null
      ? ko
        ? `AI 이미지 ${talk}`
        : `AI images: ${talk}`
      : ko
        ? `AI 이미지 생성 월 ${l.aiImages}장${plan.premiumImages ? " (고화질)" : ""}`
        : `${l.aiImages} AI images/mo${plan.premiumImages ? " (HD)" : ""}`,
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
  if (plan.aeo)
    out.push(ko ? "AEO/GEO 답변엔진 최적화(FAQ)" : "AEO/GEO (FAQ schema)");
  if (plan.aiAgent)
    out.push(
      ko
        ? "AI 비즈니스 에이전트 + 오토파일럿(자동 마케팅)"
        : "AI business agent + autopilot",
    );
  if (plan.scheduledPublish)
    out.push(ko ? "콘텐츠 예약 발행" : "Scheduled publishing");
  if (plan.reservation)
    out.push(ko ? "블로그 하단 예약(식당·매장) 기능" : "Reservations under blog posts");
  if (plan.fullHomepage)
    out.push(
      ko
        ? "AI 상세 홈페이지 생성 (자료 입력 → 풍부한 섹션)"
        : "AI detailed homepage (materials → rich sections)",
    );
  if (plan.report)
    out.push(
      plan.report === "weekly"
        ? ko
          ? "성과 리포트 (주간·월간)"
          : "Reports (weekly & monthly)"
        : ko
          ? "성과 리포트 (월간)"
          : "Reports (monthly)",
    );
  out.push(
    plan.analyticsTier === "advanced"
      ? ko
        ? "방문자 분석 (고급)"
        : "Analytics (advanced)"
      : plan.analyticsTier === "detailed"
        ? ko
          ? "방문자 분석 (상세)"
          : "Analytics (detailed)"
        : ko
          ? "방문자 분석 (기본)"
          : "Analytics (basic)",
  );

  // 관리자/직원 계정 — 2개 이상(직원 초대 가능) 또는 협의일 때만 카드에 표기.
  if (plan.maxMembers === null) {
    out.push(ko ? "관리자/직원 계정 협의" : "Team accounts: Custom");
  } else if (plan.maxMembers > 1) {
    out.push(
      ko
        ? `관리자/직원 ${plan.maxMembers}계정`
        : `${plan.maxMembers} team accounts`,
    );
  }

  // 여러 사업장 관리 — 셀링포인트가 되는 경우(협의 또는 2개 이상)만 카드에 표기.
  if (plan.maxBusinesses === null) {
    out.push(ko ? "여러 브랜드/사업장 관리 협의" : "Multi-brand management: Custom");
  } else if (plan.maxBusinesses > 1) {
    out.push(
      ko
        ? `여러 브랜드/사업장 ${plan.maxBusinesses}개 관리`
        : `Manage up to ${plan.maxBusinesses} businesses`,
    );
  }

  return out;
}
