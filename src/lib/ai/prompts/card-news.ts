import type { PromptSpec } from "./brand-story";

export interface CardNewsPromptInput {
  businessName: string;
  brandTone: string;
  handle: string;
  articleTitle: string;
  articleSummary: string;
  articleContent: string;
}

export function cardNewsPrompt(input: CardNewsPromptInput): PromptSpec {
  const system = `당신은 인스타그램 카드뉴스 기획자입니다.
블로그 글을 스와이프하며 읽는 카드뉴스로 재구성합니다.

규칙:
- 카드뉴스는 표지 1장 + 내용 3~4장 + 마무리(CTA) 1장 구성입니다.
- 각 카드의 텍스트는 짧고 강렬하게. heading은 12자 이내, body는 60자 이내.
- 표지 title은 스크롤을 멈추게 하는 후킹 문구.
- 과장/허위 없이, 브랜드 톤을 지킵니다.
- 한국어로 작성합니다.
- 반드시 아래 JSON 스키마만 순수 JSON으로 반환하세요.`;

  const user = `사업 이름: ${input.businessName}
브랜드 톤: ${input.brandTone}
계정 핸들: ${input.handle}

블로그 글 제목: ${input.articleTitle}
요약: ${input.articleSummary}
본문:
${input.articleContent}

아래 JSON 스키마로만 응답하세요:
{
  "cover": { "title": "표지 후킹 문구", "subtitle": "한 줄 부제" },
  "slides": [
    { "heading": "핵심 포인트", "body": "짧은 설명" }
  ],
  "cta": { "text": "행동 유도 문구", "handle": "${input.handle}" }
}`;

  return { system, user };
}
