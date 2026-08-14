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

export const MARKETING_PLATFORMS = ["instagram", "facebook"] as const;
export type MarketingPlatform = (typeof MARKETING_PLATFORMS)[number];

// ---- Website template content (stored in websites.content JSONB) ----

export interface WebsiteCardItem {
  title: string;
  description: string;
  image?: string;
}

export const WEBSITE_TEMPLATES = ["classic", "split", "minimal"] as const;
export type WebsiteTemplateId = (typeof WEBSITE_TEMPLATES)[number];

export interface WebsiteContent {
  /** Chosen layout template (defaults to "classic"). */
  template?: WebsiteTemplateId;
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
    website: string;
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
