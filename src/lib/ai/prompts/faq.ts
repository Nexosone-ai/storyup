import { languageRule, type PromptLanguage, type PromptSpec } from "./brand-story";

export interface BlogFaqPromptInput {
  title: string;
  content: string;
  category: string;
  language?: PromptLanguage;
}

/**
 * 블로그 글 본문에서 답변엔진(AEO)용 FAQ를 뽑아낸다.
 * 실제 사람이 검색·질문할 법한 질문 + 짧고 직접적인 답변(구글 AI Overviews·Perplexity 등이 인용하기 좋게).
 */
export function blogFaqPrompt(input: BlogFaqPromptInput): PromptSpec {
  const language = input.language ?? "ko";
  const system = `당신은 답변엔진 최적화(AEO) 전문가입니다.
블로그 글을 읽고, 잠재 고객이 실제로 검색하거나 물어볼 법한 질문과 그에 대한 간결·정확한 답변을 만듭니다.
${languageRule(language)}
- 질문은 사람이 실제로 입력하는 자연스러운 문장. 글 내용으로 답할 수 있는 것만.
- 답변은 1~2문장(40~80자)으로 직접적으로. 과장·미확인 통계·"검색 1위 보장" 같은 표현 금지.
- 3~5개. 글에 근거가 없으면 지어내지 말 것.
반드시 아래 JSON 스키마만 순수 JSON으로 반환하세요.`;

  const user = `업종: ${input.category}
글 제목: ${input.title}
본문:
${input.content.slice(0, 6000)}

아래 JSON 스키마로만 응답하세요:
{ "faq": [ { "q": "질문", "a": "간결한 직접 답변" } ] }`;

  return { system, user };
}
