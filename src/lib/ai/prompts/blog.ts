import type { BlogLength, BlogTone } from "@/types/domain";
import type { PromptSpec } from "./brand-story";

export interface BlogPromptInput {
  businessName: string;
  category: string;
  brandTone: string;
  topic: string;
  tone: BlogTone;
  length: BlogLength;
}

const LENGTH_GUIDE: Record<BlogLength, string> = {
  Short: "약 400~600자, 3~4문단",
  Medium: "약 800~1200자, 5~7문단, 소제목 2~3개",
  Long: "약 1500~2000자, 소제목 4개 이상, 도입/본문/마무리 구성",
};

export function blogPrompt(input: BlogPromptInput): PromptSpec {
  const system = `당신은 소상공인의 블로그 콘텐츠를 대신 써주는 전문 카피라이터입니다.
독자에게 실질적으로 도움이 되고 자연스럽게 읽히는 한국어 글을 씁니다.
content 는 Markdown 형식(##, **, - 목록 사용)으로 작성합니다.
과장/허위 정보를 넣지 않습니다.
반드시 아래 JSON 스키마만 순수 JSON으로 반환하세요.`;

  const user = `사업 정보:
- 사업 이름: ${input.businessName}
- 업종: ${input.category}
- 브랜드 톤: ${input.brandTone}

작성 요청:
- 주제: ${input.topic}
- 글의 톤: ${input.tone}
- 분량: ${input.length} (${LENGTH_GUIDE[input.length]})

아래 JSON 스키마로만 응답하세요:
{
  "title": "매력적인 블로그 제목",
  "summary": "1~2문장 요약",
  "content": "Markdown 본문",
  "keywords": ["SEO 키워드 5개"],
  "seo_title": "60자 이내 SEO 제목",
  "seo_description": "150자 이내 메타 설명",
  "social_caption": "SNS 공유용 짧은 캡션",
  "image_subject": "커버 사진 피사체 묘사 (영어 한 문장, 사람·손·글자 없이 구체적인 사물·음식·공간만. 예: freshly baked sourdough bread loaves and wheat stalks on a rustic wooden table)"
}`;

  return { system, user };
}
