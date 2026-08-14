import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider} from "./provider";
import {
  AIGenerationError,
} from "./provider";
import type {
  BrandStoryResult,
  BlogArticleResult,
  MarketingContentResult,
  CardNewsResult,
  WebsiteContent,
  BusinessInterviewInput,
} from "@/types/domain";
import { brandStoryPrompt, type PromptSpec } from "./prompts/brand-story";
import { websitePrompt } from "./prompts/website";
import { blogPrompt, type BlogPromptInput } from "./prompts/blog";
import {
  marketingPrompt,
  type MarketingPromptInput,
} from "./prompts/marketing";
import { cardNewsPrompt, type CardNewsPromptInput } from "./prompts/card-news";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY, model = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new AIGenerationError(
        "AI 서비스가 설정되지 않았습니다. (ANTHROPIC_API_KEY 누락)",
      );
    }
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  private async complete<T>(spec: PromptSpec, maxTokens = 2000): Promise<T> {
    let raw = "";
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system: spec.system,
        messages: [{ role: "user", content: spec.user }],
      });
      raw = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    } catch (err) {
      throw new AIGenerationError("AI 응답을 받지 못했습니다.", err);
    }
    return parseJson<T>(raw);
  }

  generateBrandStory(input: BusinessInterviewInput) {
    return this.complete<BrandStoryResult>(brandStoryPrompt(input), 2500);
  }

  async generateWebsite(
    business: BusinessInterviewInput,
    brand: BrandStoryResult,
  ): Promise<WebsiteContent> {
    return this.complete<WebsiteContent>(
      websitePrompt(business, brand),
      2500,
    );
  }

  generateBlog(input: BlogPromptInput) {
    return this.complete<BlogArticleResult>(blogPrompt(input), 3000);
  }

  generateMarketing(input: MarketingPromptInput) {
    return this.complete<MarketingContentResult>(
      marketingPrompt(input),
      1500,
    );
  }

  generateCardNews(input: CardNewsPromptInput) {
    return this.complete<CardNewsResult>(cardNewsPrompt(input), 1500);
  }
}

/** Tolerant JSON extraction — strips code fences / prose around the object. */
function parseJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?/gim, "")
    .replace(/```$/gim, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate =
    start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;

  try {
    return JSON.parse(candidate) as T;
  } catch (err) {
    throw new AIGenerationError("AI 응답 형식을 해석하지 못했습니다.", err);
  }
}
