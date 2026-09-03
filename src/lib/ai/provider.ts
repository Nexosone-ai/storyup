import type {
  BrandStoryResult,
  BlogArticleResult,
  MarketingContentResult,
  CardNewsResult,
  WebsiteContent,
  BusinessInterviewInput,
} from "@/types/domain";
import type { BlogPromptInput } from "./prompts/blog";
import type { MarketingPromptInput } from "./prompts/marketing";
import type { CardNewsPromptInput } from "./prompts/card-news";
import type { PromptLanguage } from "./prompts/brand-story";
import type { PdfLandingExtract } from "@/lib/pdfImport";

/**
 * Model-agnostic AI interface. Swap providers (Claude, others) or add
 * SNS/model integrations behind this contract without touching callers.
 */
export interface AIProvider {
  generateBrandStory(
    input: BusinessInterviewInput,
    language?: PromptLanguage,
  ): Promise<BrandStoryResult>;

  generateWebsite(
    business: BusinessInterviewInput,
    brand: BrandStoryResult,
    language?: PromptLanguage,
  ): Promise<WebsiteContent>;

  generateBlog(input: BlogPromptInput): Promise<BlogArticleResult>;

  generateMarketing(
    input: MarketingPromptInput,
  ): Promise<MarketingContentResult>;

  generateCardNews(input: CardNewsPromptInput): Promise<CardNewsResult>;

  /**
   * 이미지 생성용 영문 피사체 한 문장을 만든다 (사람 없는 정물 장면).
   * 한글 키워드는 이미지 모델이 이해하지 못해 피사체 없는 이미지가 나온다.
   */
  generateImageSubject(input: {
    category: string;
    text: string;
  }): Promise<string>;

  /** PDF(소개서·브로슈어)에서 랜딩페이지 콘텐츠를 추출한다. */
  extractLandingContent(
    pdfBase64: string,
    language?: PromptLanguage,
  ): Promise<PdfLandingExtract>;
}

/** Raised when generation fails; carries a user-safe message. */
export class AIGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIGenerationError";
  }
}
