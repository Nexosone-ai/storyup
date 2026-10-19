import { languageRule, type PromptLanguage, type PromptSpec } from "./brand-story";

export interface BlogSeoPromptInput {
  title: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  keywords: string[];
  content: string;
  category: string;
  language?: PromptLanguage;
}

/**
 * 글별 SEO·AEO·네이버·LLM 노출 진단 + 개선 문구 제안.
 * "에이전시 없이" 각 글이 검색/AI 답변에 어떻게 노출되는지 보고, 바로 적용 가능한
 * 개선안(제목·메타·결론 먼저 도입문단·키워드·FAQ)을 돌려준다. 과장·미확인 통계 금지.
 */
export function blogSeoPrompt(input: BlogSeoPromptInput): PromptSpec {
  const language = input.language ?? "ko";
  const system = `당신은 검색엔진 최적화(SEO)와 답변엔진 최적화(AEO/GEO/네이버) 전문가입니다.
블로그 글 하나를 보고, 이 글이 구글·네이버 검색과 AI 답변(구글 AI Overviews·Perplexity·ChatGPT 등)에
어떻게 노출될지 진단하고, 순위·인용 가능성을 높일 구체적 보강안을 제안합니다.
${languageRule(language)}
진단·제안 원칙:
- 약점(weaknesses)은 이 글에 실제로 해당하는 것만, 짧고 구체적으로(각 1문장).
- seoTitle: 핵심 키워드를 앞에, 50~60자. seoDescription: 글을 정확히 요약, 150~160자.
- firstParagraph: "결론 먼저" 40자 내외의 직접 답변으로 시작하는 도입 문단(AI가 인용하기 좋게).
- keywords: 실제 검색 수요가 있을 법한 보강 키워드(기존과 중복 최소).
- faqIdeas: 글 내용으로 답할 수 있는 질문 2~4개(q 자연스러운 질문, a 40~80자 직답).
- 과장, 미확인 통계·수치, "검색 1위 보장" 류 표현 금지. 글에 근거 없는 내용은 지어내지 말 것.
반드시 아래 JSON 스키마만 순수 JSON으로 반환하세요.`;

  const user = `업종: ${input.category}
현재 제목: ${input.title}
현재 SEO 제목: ${input.seoTitle ?? "(없음)"}
현재 메타 설명: ${input.seoDescription ?? "(없음)"}
현재 키워드: ${input.keywords.join(", ") || "(없음)"}
본문:
${input.content.slice(0, 7000)}

아래 JSON 스키마로만 응답하세요:
{
  "weaknesses": ["이 글의 약점 1", "약점 2"],
  "seoTitle": "개선된 SEO 제목(50~60자)",
  "seoDescription": "개선된 메타 설명(150~160자)",
  "firstParagraph": "결론 먼저 시작하는 개선 도입 문단",
  "keywords": ["보강 키워드1", "보강 키워드2"],
  "faqIdeas": [ { "q": "질문", "a": "간결한 직접 답변" } ]
}`;

  return { system, user };
}
