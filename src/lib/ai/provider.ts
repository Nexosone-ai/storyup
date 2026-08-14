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

/**
 * Model-agnostic AI interface. Swap providers (Claude, others) or add
 * SNS/model integrations behind this contract without touching callers.
 */
export interface AIProvider {
  generateBrandStory(
    input: BusinessInterviewInput,
  ): Promise<BrandStoryResult>;

  generateWebsite(
    business: BusinessInterviewInput,
    brand: BrandStoryResult,
  ): Promise<WebsiteContent>;

  generateBlog(input: BlogPromptInput): Promise<BlogArticleResult>;

  generateMarketing(
    input: MarketingPromptInput,
  ): Promise<MarketingContentResult>;

  generateCardNews(input: CardNewsPromptInput): Promise<CardNewsResult>;
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
