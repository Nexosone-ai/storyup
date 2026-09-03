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
import {
  brandStoryPrompt,
  type PromptLanguage,
  type PromptSpec,
} from "./prompts/brand-story";
import { websitePrompt } from "./prompts/website";
import { blogPrompt, type BlogPromptInput } from "./prompts/blog";
import {
  marketingPrompt,
  type MarketingPromptInput,
} from "./prompts/marketing";
import { cardNewsPrompt, type CardNewsPromptInput } from "./prompts/card-news";
import type { PdfLandingExtract } from "@/lib/pdfImport";

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

  generateBrandStory(
    input: BusinessInterviewInput,
    language: PromptLanguage = "ko",
  ) {
    return this.complete<BrandStoryResult>(
      brandStoryPrompt(input, language),
      2500,
    );
  }

  async generateWebsite(
    business: BusinessInterviewInput,
    brand: BrandStoryResult,
    language: PromptLanguage = "ko",
  ): Promise<WebsiteContent> {
    return this.complete<WebsiteContent>(
      websitePrompt(business, brand, language),
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

  /** PDF(회사 소개서·브로슈어·메뉴판 등)에서 랜딩페이지 콘텐츠를 추출한다. */
  async extractLandingContent(
    pdfBase64: string,
    language: PromptLanguage = "ko",
  ): Promise<PdfLandingExtract> {
    const ko = language === "ko";
    let raw = "";
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 2500,
        system: ko
          ? "당신은 사업체 소개 자료를 랜딩페이지 콘텐츠로 옮기는 카피라이터입니다. 반드시 순수 JSON만 반환하세요."
          : "You turn business brochures into landing page copy. Return pure JSON only.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                type: "text",
                text: `이 PDF는 한 사업체의 소개 자료입니다. 랜딩페이지에 넣을 콘텐츠를 추출해 아래 JSON으로만 응답하세요.

규칙:
- 모든 텍스트는 ${ko ? "한국어" : "영어(English)"}로 작성 (원문이 다른 언어면 번역)
- PDF에 없는 항목은 빈 문자열 "" / 빈 배열
- 전화번호·이메일·주소·URL은 원문 그대로
- headline은 고객을 끌어당기는 한 문장(30자 내외), shortDescription은 1~2문장
- storyBody는 사업 소개·철학을 2~4문장으로
- offers는 대표 상품/서비스 최대 3개

{
  "name": "사업체 이름",
  "headline": "",
  "shortDescription": "",
  "storyTitle": "",
  "storyBody": "",
  "offers": [{ "title": "", "description": "" }],
  "phone": "",
  "email": "",
  "address": "",
  "website": "",
  "instagram": "",
  "facebook": "",
  "x": ""
}`,
              },
            ],
          },
        ],
      });
      raw = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    } catch (err) {
      throw new AIGenerationError("AI 응답을 받지 못했습니다.", err);
    }
    const parsed = parseJson<Partial<PdfLandingExtract>>(raw);
    // 누락 필드를 빈 값으로 정규화해 호출부가 안심하고 쓰게 한다.
    const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    return {
      name: s(parsed.name),
      headline: s(parsed.headline),
      shortDescription: s(parsed.shortDescription),
      storyTitle: s(parsed.storyTitle),
      storyBody: s(parsed.storyBody),
      offers: Array.isArray(parsed.offers)
        ? parsed.offers
            .slice(0, 3)
            .map((o) => ({ title: s(o?.title), description: s(o?.description) }))
            .filter((o) => o.title || o.description)
        : [],
      phone: s(parsed.phone),
      email: s(parsed.email),
      address: s(parsed.address),
      website: s(parsed.website),
      instagram: s(parsed.instagram),
      facebook: s(parsed.facebook),
      x: s(parsed.x),
    };
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
