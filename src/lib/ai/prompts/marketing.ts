import { languageRule, type PromptLanguage, type PromptSpec } from "./brand-story";

export interface MarketingPromptInput {
  businessName: string;
  brandTone: string;
  articleTitle: string;
  articleSummary: string;
  articleContent: string;
  language?: PromptLanguage;
}

export function marketingPrompt(input: MarketingPromptInput): PromptSpec {
  const language = input.language ?? "ko";
  const system = `당신은 소상공인을 위한 SNS 마케팅 카피라이터입니다.
블로그 글을 바탕으로 각 플랫폼 성격에 맞는 게시물을 작성합니다.
${languageRule(language)}
- Instagram: 캐주얼하고 감성적, 줄바꿈과 이모지 활용, 마지막에 관련 해시태그 5~8개${language === "en" ? " (hashtags in English)" : ""}.
- Facebook: 조금 더 서술적이고 정보 전달 중심, 해시태그는 3개 이내.
반드시 아래 JSON 스키마만 순수 JSON으로 반환하세요.`;

  const user = `사업 이름: ${input.businessName}
브랜드 톤: ${input.brandTone}

블로그 글 제목: ${input.articleTitle}
요약: ${input.articleSummary}
본문:
${input.articleContent}

아래 JSON 스키마로만 응답하세요:
{
  "instagram": "인스타그램 캡션 (해시태그 포함)",
  "facebook": "페이스북 게시물"
}`;

  return { system, user };
}
