import type {
  BrandStoryResult,
  BlogArticleResult,
  MarketingContentResult,
  MarketingStrategyResult,
  BlogFaqResult,
  BlogSeoAnalysisResult,
  CardNewsResult,
  WebsiteContent,
  BusinessInterviewInput,
} from "@/types/domain";
import type { MarketingStrategyPromptInput } from "./prompts/strategy";
import type { BlogFaqPromptInput } from "./prompts/faq";
import type { BlogSeoPromptInput } from "./prompts/seo";
import type { DesignEditPromptInput } from "./prompts/design";
import type {
  BlogPromptInput,
  BlogTranscriptPromptInput,
  BlogExpandPromptInput,
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

  /** (프리미엄) 사용자 자료(brief)로 풍부한 섹션·컨셉까지 생성한다. */
  generateRichWebsite(
    business: BusinessInterviewInput,
    brand: BrandStoryResult,
    brief: string,
    language?: PromptLanguage,
  ): Promise<WebsiteContent>;

  /** (프리미엄) 자료로 홈 + 하위 페이지(pages[])까지 구성한 멀티페이지 사이트를 생성한다. */
  generateMultiPageWebsite(
    business: BusinessInterviewInput,
    brand: BrandStoryResult,
    brief: string,
    language?: PromptLanguage,
  ): Promise<WebsiteContent>;

  generateBlog(input: BlogPromptInput): Promise<BlogArticleResult>;

  /** 음성 녹음 전사문을 블로그 글로 재구성한다. */
  generateBlogFromTranscript(
    input: BlogTranscriptPromptInput,
  ): Promise<BlogArticleResult>;

  /** 초안 본문의 한 단락을 이어서 더 작성한다 (에디터 단락 보강용). */
  expandBlogParagraph(
    input: BlogExpandPromptInput,
  ): Promise<{ text: string }>;

  generateMarketing(
    input: MarketingPromptInput,
  ): Promise<MarketingContentResult>;

  /** 사용 분석 지표를 바탕으로 실행 가능한 마케팅 전략을 제안한다. */
  generateMarketingStrategy(
    input: MarketingStrategyPromptInput,
  ): Promise<MarketingStrategyResult>;

  /** 블로그 글에서 답변엔진(AEO)용 FAQ를 생성한다. */
  generateBlogFaq(input: BlogFaqPromptInput): Promise<BlogFaqResult>;

  /** 글별 SEO·AEO 노출 진단 + 개선 문구 제안. */
  generateBlogSeoAnalysis(
    input: BlogSeoPromptInput,
  ): Promise<BlogSeoAnalysisResult>;

  /** Page Schema를 자연어 요청대로 수정 — 전체 스키마 JSON 반환(서버가 재검증). */
  editDesignSchema(
    input: DesignEditPromptInput,
  ): Promise<Record<string, unknown>>;

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
    /** true면 사용자가 요청한 사람·인물·행동을 장면에 충실히 포함(기본 false=사람 배제). */
    allowPeople?: boolean;
    /** 콘텐츠 언어 — ko면 등장 인물을 한국인(동양인)으로 묘사(기본 ko). */
    language?: PromptLanguage;
  }): Promise<string>;

  /** PDF(소개서·브로슈어)에서 랜딩페이지 콘텐츠를 추출한다. */
  extractLandingContent(
    pdfBase64: string,
    language?: PromptLanguage,
  ): Promise<PdfLandingExtract>;

  /** 웹페이지에서 긁어온 본문 텍스트로 랜딩페이지 콘텐츠를 추출한다(URL 불러오기). */
  extractLandingFromText(
    text: string,
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
