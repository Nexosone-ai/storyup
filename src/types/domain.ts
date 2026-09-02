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

export const BRAND_TONES = [
  "Professional",
  "Friendly",
  "Premium",
  "Modern",
  "Emotional",
  "Innovative",
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

export const SUPPORTER_ROLES = ["designer", "editor", "musician"] as const;
export type SupporterRole = (typeof SUPPORTER_ROLES)[number];

export const SUPPORTER_ROLE_LABEL: Record<SupporterRole, string> = {
  designer: "디자이너",
  editor: "영상 편집자",
  musician: "음악 제작자",
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

export const WEBSITE_TEMPLATES = ["classic", "split", "minimal"] as const;
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
  /** Optional photo gallery band (user-uploaded image URLs). */
  gallery?: string[];
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

// ---- Card news (Instagram carousel) ----

export interface CardNewsSlide {
  heading: string;
  body: string;
}

export interface CardNewsResult {
  cover: { title: string; subtitle: string };
  slides: CardNewsSlide[]; // 3–4 content slides
  cta: { text: string; handle: string };
}

// Input the onboarding wizard collects.
export interface BusinessInterviewInput {
  name: string;
  category: BusinessCategory;
  founder_story: string;
  target_customer: string;
  strengths: string;
  tone: BrandTone;
}
