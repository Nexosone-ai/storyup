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

  async generateImageSubject(input: {
    category: string;
    text: string;
  }): Promise<string> {
    const spec: PromptSpec = {
      system:
        '당신은 사진 촬영 지시문을 쓰는 아트 디렉터입니다. 반드시 {"subject": "..."} 형태의 순수 JSON만 반환하세요.',
      user: `업종: ${input.category}
내용: ${input.text.slice(0, 300)}

위 내용을 대표하는 정물 사진의 피사체를 영어 한 문장으로 묘사하세요.
- 구체적인 사물·음식·공간 디테일만 포함
- 사람, 손, 신체, 글자는 절대 포함 금지
- 예: "freshly baked sourdough bread loaves and wheat stalks on a rustic wooden table"

{"subject": "..."} JSON으로만 응답하세요.`,
    };
    const res = await this.complete<{ subject: string }>(spec, 300);
    return res.subject;
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
