import type {
  BrandStoryResult,
  BlogArticleResult,
  MarketingContentResult,
  CardNewsResult,
  WebsiteContent,
  BusinessInterviewInput,
} from "@/types/domain";
import type {
  BlogPromptInput,
  BlogTranscriptPromptInput,
} from "./prompts/blog";
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

  /** 음성 녹음 전사문을 블로그 글로 재구성한다. */
  generateBlogFromTranscript(
    input: BlogTranscriptPromptInput,
  ): Promise<BlogArticleResult>;

  generateMarketing(
    input: MarketingPromptInput,
  ): Promise<MarketingContentResult>;

  generateCardNews(input: CardNewsPromptInput): Promise<CardNewsResult>;

  /**
   * 이미지 생성용 영문 피사체 한 문장을 만든다 (사람 없는 장면).
   * 한글 키워드는 이미지 모델이 이해하지 못해 피사체 없는 이미지가 나온다.
   * kind: still-life(카드뉴스·블로그 커버용 정물) | scene(랜딩페이지용 공간/현장).
   */
  generateImageSubject(input: {
    category: string;
    text: string;
    kind?: "still-life" | "scene";
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
