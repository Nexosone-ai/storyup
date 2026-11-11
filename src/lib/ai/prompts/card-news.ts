import { languageRule, type PromptLanguage, type PromptSpec } from "./brand-story";

export interface CardNewsPromptInput {
  businessName: string;
  brandTone: string;
  handle: string;
  articleTitle: string;
  articleSummary: string;
  articleContent: string;
  language?: PromptLanguage;
  /**
   * 사용자가 직접 넣은 스토리(선택). 있으면 이 스토리를 중심으로 기승전결을 구성하고
   * 블로그 글은 보조 자료로만 쓴다. 없으면 블로그 글에서 스토리를 뽑는다.
   */
  story?: string;
}

/**
 * 카드뉴스 프롬프트 — 블로그 관련 이미지 나열이 아니라 **기승전결 스토리**(2026-11-11).
 * 표지 1 + 기(ki)·승(seung)·전(jeon)·결(gyeol) 4장 + 마무리(CTA) 1장 = 6장(CARD_NEWS_PAGES).
 * 각 카드의 body 는 "기본 멘트"로, 사용자가 스튜디오에서 바꿀 수 있다.
 */
export function cardNewsPrompt(input: CardNewsPromptInput): PromptSpec {
  const language = input.language ?? "ko";
  const lengthRule =
    language === "en"
      ? "heading under 6 words, body (the spoken-style caption) under 100 characters."
      : "heading은 14자 이내, body(멘트)는 구어체 1~2문장 70자 이내.";
  const system = `당신은 인스타그램 카드뉴스 스토리 작가입니다.
블로그 글(또는 사용자가 준 스토리)을 스와이프하며 읽는 '기승전결' 카드뉴스로 재구성합니다.

규칙:
- 구성은 표지 1장 + 내용 4장(기·승·전·결, 이 순서 고정) + 마무리(CTA) 1장입니다.
- 기(ki): 상황·주인공·공감되는 시작. 승(seung): 문제·고민이 커지는 전개. 전(jeon): 전환점 — 발견·해결·변화. 결(gyeol): 결과와 남기고 싶은 메시지.
- 각 내용 카드의 body는 독자에게 말을 거는 '기본 멘트'입니다(사용자가 나중에 고칩니다). ${lengthRule}
- 표지 title은 스크롤을 멈추게 하는 후킹 문구, subtitle은 이야기의 한 줄 요약.
- 마무리(CTA) text는 이야기의 여운을 잇는 행동 유도 문구.
- 사용자 스토리가 있으면 그 스토리를 중심으로 쓰고 블로그 글은 보조로만 참고합니다. 없는 사실·수치는 지어내지 않습니다.
- 과장/허위 없이, 브랜드 톤을 지킵니다.
- ${languageRule(language)}
- 반드시 아래 JSON 스키마만 순수 JSON으로 반환하세요. slides는 정확히 4개, stage 값은 "ki","seung","jeon","gyeol" 순서입니다.`;

  const storyBlock = input.story?.trim()
    ? `
사용자 스토리(이 이야기를 중심으로 기승전결 구성):
${input.story.trim()}
`
    : "";

  const user = `사업 이름: ${input.businessName}
브랜드 톤: ${input.brandTone}
계정 핸들: ${input.handle}
${storyBlock}
블로그 글 제목: ${input.articleTitle}
요약: ${input.articleSummary}
본문:
${input.articleContent}

아래 JSON 스키마로만 응답하세요:
{
  "cover": { "title": "표지 후킹 문구", "subtitle": "이야기 한 줄 요약" },
  "slides": [
    { "stage": "ki", "heading": "시작", "body": "기본 멘트" },
    { "stage": "seung", "heading": "전개", "body": "기본 멘트" },
    { "stage": "jeon", "heading": "전환", "body": "기본 멘트" },
    { "stage": "gyeol", "heading": "마무리", "body": "기본 멘트" }
  ],
  "cta": { "text": "행동 유도 문구", "handle": "${input.handle}" }
}`;

  return { system, user };
}
