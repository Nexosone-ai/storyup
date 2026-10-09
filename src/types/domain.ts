// ------------------------------------------------------------------
//  Shared domain enums & shapes
// ------------------------------------------------------------------

export const BUSINESS_CATEGORIES = [
  "Restaurant",
  "Cafe",
  "Beauty",
  "Retail",
  "Professional Service",
  "Startup",
  "Freelancer",
  "E-commerce",
  "Technology",
  "Education",
  "Other",
] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

/**
 * 업종 대분류(10개) — 사장님이 브랜드 설정에서 고르고, 쇼케이스에서 업종별로 필터한다.
 * 기존 category(영문, AI 프롬프트용)와 별개인 사용자용 분류다.
 */
export const INDUSTRIES = [
  { id: "food", ko: "음식·카페", en: "Food & Cafe" },
  { id: "retail", ko: "쇼핑·유통", en: "Shopping & Retail" },
  { id: "beauty", ko: "뷰티·건강", en: "Beauty & Health" },
  { id: "education", ko: "교육·문화", en: "Education & Culture" },
  { id: "service", ko: "생활·전문서비스", en: "Living & Pro Services" },
  { id: "realestate", ko: "부동산·건축", en: "Real Estate & Building" },
  { id: "travel", ko: "여행·레저·자동차", en: "Travel, Leisure & Auto" },
  { id: "tech", ko: "IT·마케팅·콘텐츠", en: "IT, Marketing & Content" },
  { id: "manufacturing", ko: "제조·기업·산업", en: "Manufacturing & Industry" },
  { id: "etc", ko: "단체·개인·기타", en: "Groups, Personal & Other" },
] as const;
export type IndustryId = (typeof INDUSTRIES)[number]["id"];
export const INDUSTRY_IDS = INDUSTRIES.map((i) => i.id) as IndustryId[];

/** 업종 id → 표시 라벨. 알 수 없거나 미설정이면 null. */
export function industryLabel(
  id: string | null | undefined,
  ko: boolean,
): string | null {
  if (!id) return null;
  const found = INDUSTRIES.find((i) => i.id === id);
  return found ? (ko ? found.ko : found.en) : null;
}

export const BRAND_TONES = [
  "Professional",
  "Friendly",
  "Premium",
  "Modern",
  "Emotional",
  "Innovative",
  "Trustworthy",
  "Warm",
  "Energetic",
  "Calm",
  "Playful",
  "Sophisticated",
  "Natural",
  "Traditional",
  "Bold",
  "Minimal",
  "Youthful",
  "Cozy",
] as const;
export type BrandTone = (typeof BRAND_TONES)[number];

export type PublishStatus = "draft" | "published";

export const BLOG_TONES = [
  "Friendly",
  "Professional",
  "Informative",
  "Storytelling",
  "Promotional",
] as const;
export type BlogTone = (typeof BLOG_TONES)[number];

export const BLOG_LENGTHS = ["Short", "Medium", "Long"] as const;
export type BlogLength = (typeof BLOG_LENGTHS)[number];

// 값은 DB·AI 프롬프트에서 그대로 쓰이므로 표시용 한글 라벨만 분리
export const BLOG_TONE_LABEL: Record<BlogTone, string> = {
  Friendly: "친근한",
  Professional: "전문적인",
  Informative: "정보 전달형",
  Storytelling: "스토리텔링",
  Promotional: "홍보형",
};

export const BLOG_LENGTH_LABEL: Record<BlogLength, string> = {
  Short: "짧게",
  Medium: "보통",
  Long: "길게",
};

export const MARKETING_PLATFORMS = ["instagram", "facebook"] as const;
export type MarketingPlatform = (typeof MARKETING_PLATFORMS)[number];

export const PUBLISH_CHANNELS = ["blogger", "tistory", "naver"] as const;
export type PublishChannel = (typeof PUBLISH_CHANNELS)[number];

export const PUBLISH_CHANNEL_LABEL: Record<PublishChannel, string> = {
  blogger: "Google Blogger",
  tistory: "티스토리",
  naver: "네이버 블로그",
};

export const SUPPORTER_ROLES = [
  "designer",
  "editor",
  "musician",
  "agent",
] as const;
export type SupporterRole = (typeof SUPPORTER_ROLES)[number];

export const SUPPORTER_ROLE_LABEL: Record<SupporterRole, string> = {
  designer: "디자이너",
  editor: "영상 편집자",
  musician: "음악 제작자",
  agent: "스토리업 대행",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  requested: "요청됨",
  accepted: "수락됨",
  declined: "거절됨",
  completed: "완료됨",
};

/** Platform fee (%) taken from premium-template sales. */
export const PLATFORM_FEE_PERCENT = 20;

// ---- Website template content (stored in websites.content JSONB) ----

export interface WebsiteCardItem {
  title: string;
  description: string;
  image?: string;
}

export const WEBSITE_TEMPLATES = [
  "classic",
  "split",
  "minimal",
  "bold",
  "elegant",
  "vibrant",
  "magazine",
  "warm",
  "modern",
] as const;
export type WebsiteTemplateId = (typeof WEBSITE_TEMPLATES)[number];

export const WEBSITE_PALETTES = [
  "forest",
  "ocean",
  "plum",
  "terracotta",
  "rose",
  "charcoal",
  "sky",
  "mint",
  "lavender",
  "pink",
  "peach",
] as const;
export type WebsitePaletteId = (typeof WEBSITE_PALETTES)[number];

export const WEBSITE_FONTS = ["default", "noto-sans", "serif", "gowun"] as const;
export type WebsiteFontId = (typeof WEBSITE_FONTS)[number];

/** (프리미엄) 풍부한 홈페이지 섹션 — 가변 유형의 콘텐츠 블록. */
export interface SiteFeatureItem {
  title: string;
  description: string;
}
export interface SitePricingItem {
  name: string;
  price: string;
  description?: string;
  features?: string[];
  highlighted?: boolean;
}
export interface SiteStepItem {
  title: string;
  description: string;
}
export interface SiteFaqItem {
  q: string;
  a: string;
}
export interface SiteTestimonialItem {
  quote: string;
  author: string;
  role?: string;
}
export interface SiteStatItem {
  value: string;
  label: string;
}

export const SITE_SECTION_TYPES = [
  "features",
  "pricing",
  "steps",
  "faq",
  "testimonials",
  "stats",
  "cta",
  "richText",
] as const;
export type SiteSectionType = (typeof SITE_SECTION_TYPES)[number];

export type SiteSection =
  | { type: "features"; title: string; subtitle?: string; items: SiteFeatureItem[] }
  | { type: "pricing"; title: string; subtitle?: string; items: SitePricingItem[] }
  | { type: "steps"; title: string; subtitle?: string; items: SiteStepItem[] }
  | { type: "faq"; title: string; subtitle?: string; items: SiteFaqItem[] }
  | {
      type: "testimonials";
      title: string;
      subtitle?: string;
      items: SiteTestimonialItem[];
    }
  | { type: "stats"; title?: string; items: SiteStatItem[] }
  | { type: "cta"; title: string; body?: string; ctaLabel?: string }
  | { type: "richText"; title: string; body: string };

/**
 * (프리미엄) 멀티페이지 — 홈 외 추가 페이지. 각 페이지는 선택적 hero + 섹션 배열로
 * 구성되고, 상단 메뉴(nav)에 노출된다. 없으면 기존 단일 페이지와 동일(하위호환).
 * 공개 경로: /site/{slug}/{page.slug} (예약어 blog/ads.txt 등은 금지).
 */
export interface SitePage {
  id: string;
  slug: string;
  navLabel: string;
  showInNav: boolean;
  hero?: {
    headline: string;
    shortDescription?: string;
    image?: string;
    ctaLabel?: string;
  };
  sections: SiteSection[];
  seo?: { title?: string; description?: string };
}

export interface WebsiteContent {
  /** Chosen layout template (defaults to "classic"). */
  template?: WebsiteTemplateId;
  /** 사이트 콘텐츠 언어 — 생성 시 대시보드 로케일이 저장된다 (기본 ko). */
  language?: "ko" | "en";
  /** Visual style picked in the editor (defaults to forest + default font). */
  style?: {
    palette?: WebsitePaletteId;
    font?: WebsiteFontId;
  };
  hero: {
    businessName: string;
    headline: string;
    shortDescription: string;
    ctaLabel: string;
    image?: string;
    /** 직접 업로드한 가게 로고 — 있으면 사이트 헤더에 이름과 함께 표시된다. */
    logo?: string;
  };
  story: {
    title: string;
    body: string;
  };
  offers: {
    title: string;
    items: WebsiteCardItem[]; // 3
  };
  whyChooseUs: {
    title: string;
    items: WebsiteCardItem[]; // 3
  };
  contact: {
    phone: string;
    email: string;
    address: string;
    instagram: string;
    /** SNS 링크 — 기존 데이터에는 없을 수 있어 optional. */
    facebook?: string;
    x?: string;
    website: string;
  };
  /**
   * (프리미엄) 풍부한 홈페이지 섹션 — 사용자가 입력한 자료로 AI가 구성한 가변
   * 섹션 배열. 기존 고정 섹션(강점) 다음, 갤러리/연락처 앞에 순서대로 렌더된다.
   * 없거나 빈 배열이면 기존 랜딩페이지와 동일하게 동작(하위호환).
   */
  sections?: SiteSection[];
  /** (프리미엄) 멀티페이지 — 홈 외 추가 페이지들. 없으면 단일 페이지(하위호환). */
  pages?: SitePage[];
  /** Optional photo gallery band (user-uploaded image URLs). */
  gallery?: string[];
  /**
   * Google AdSense 자동광고 연결 (선택). 사장님이 본인 퍼블리셔 ID를 넣으면
   * 발행 사이트 <head>에 자동광고 로더가 삽입되고, 커스텀 도메인 ads.txt에
   * 해당 퍼블리셔 라인이 노출된다. 수익은 사장님 계정으로 귀속된다.
   * 미설정이면 광고 없음. (AdSense 승인은 사장님이 소유한 도메인=커스텀 도메인 권장)
   */
  adsense?: {
    /** 정규화된 클라이언트 ID "ca-pub-################" (16자리). */
    publisherId: string;
  };
}

// ---- AI generation payloads ----

export interface BrandStoryResult {
  brand_name: string;
  headline: string;
  slogan: string;
  short_description: string;
  brand_story: string;
  mission: string;
  target_customer: string;
  key_strengths: string[];
  brand_keywords: string[];
  tone: string;
}

export interface BlogArticleResult {
  title: string;
  summary: string;
  content: string; // markdown
  keywords: string[];
  seo_title: string;
  seo_description: string;
  social_caption: string;
  /** 커버 사진용 영문 피사체 묘사 (사람 없는 정물 장면) */
  image_subject?: string;
}

export interface MarketingContentResult {
  instagram: string;
  facebook: string;
}

// ---- AEO: 블로그 FAQ (답변엔진 최적화) ----

export interface BlogFaqItem {
  /** 방문자가 검색·질문할 법한 실제 질문 */
  q: string;
  /** 40~60자 내외의 직접적인 답변 */
  a: string;
}

export interface BlogFaqResult {
  faq: BlogFaqItem[];
}

// ---- AI 마케팅 전략 (사용 분석 기반) ----

export interface MarketingStrategyAction {
  /** 실행 항목 제목 */
  title: string;
  /** 왜 필요한지 — 지표 근거 */
  reason: string;
  /** 어떻게 실행하는지 — 구체적 방법 */
  how: string;
}

export interface MarketingStrategyResult {
  /** 현재 성과 한줄 요약 */
  summary: string;
  /** 이번 기간 핵심 집중 포인트 */
  focus: string;
  /** 우선순위 실행 항목 3~5개 */
  actions: MarketingStrategyAction[];
}

// ---- Card news (Instagram carousel) ----

export interface CardNewsSlide {
  heading: string;
  body: string;
}

/** 카드 텍스트 사용자 편집 스타일 (기본값 대비 배율·em 단위). */
export interface CardTextStyle {
  /** 글자 크기 배율 (기본 1, 0.7~1.4) */
  scale?: number;
  /** 자간 em (기본 0, -0.05~0.1) */
  letterSpacing?: number;
  /** 줄간격 배율 (기본 1, 0.9~1.8) */
  lineHeight?: number;
}

export interface CardNewsResult {
  cover: { title: string; subtitle: string };
  slides: CardNewsSlide[]; // 3–4 content slides
  cta: { text: string; handle: string };
  /**
   * 카드별 배경 이미지 URL (toIGCards 순서: cover → slides → cta).
   * AI 생성/직접 업로드 후 저장되며, 스튜디오 복원과 쇼케이스 표시에 쓰인다.
   */
  images?: (string | null)[];
  /** 카드별 텍스트 스타일 (toIGCards 순서와 동일한 인덱스). 사용자 편집값. */
  cardStyles?: CardTextStyle[];
}

// Input the onboarding wizard collects.
export interface BusinessInterviewInput {
  name: string;
  category: BusinessCategory;
  /** 업종 대분류 id (쇼케이스 분류용). 온보딩에서 선택 사항. */
  industry?: IndustryId;
  founder_story: string;
  target_customer: string;
  strengths: string;
  tone: BrandTone;
}
