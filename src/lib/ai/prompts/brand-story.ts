import type { BusinessInterviewInput } from "@/types/domain";

export interface PromptSpec {
  system: string;
  user: string;
}

/** 생성 결과물의 언어 — 대시보드 로케일을 따라간다. */
export type PromptLanguage = "ko" | "en";

/** 모든 프롬프트에 공통으로 들어가는 출력 언어 규칙. */
export function languageRule(language: PromptLanguage): string {
  return language === "en"
    ? "Write EVERY piece of output text in natural, fluent English — titles, headings, body copy, hashtags, and CTA labels included. Do not output any Korean."
    : "모든 출력 텍스트를 자연스러운 한국어로 작성하세요.";
}

export function brandStoryPrompt(
  input: BusinessInterviewInput,
  language: PromptLanguage = "ko",
): PromptSpec {
  const system = `당신은 소상공인과 창업자를 돕는 전문 브랜드 스토리텔러입니다.
사용자가 들려준 실제 이야기를 최대한 보존하면서, 과장된 광고 문구가 아닌
진정성 있고 따뜻한 브랜드 스토리를 만들어 주세요.

규칙:
- 사용자의 실제 표현과 동기를 존중하고 왜곡하지 마세요.
- 없는 사실(수상 경력, 지점 수, 매출 등)을 지어내지 마세요.
- ${languageRule(language)}
- 반드시 아래 JSON 스키마만 반환하세요. 코드블록이나 설명 없이 순수 JSON만 출력합니다.`;

  const user = `다음 사업 정보를 바탕으로 브랜드 스토리를 만들어 주세요.

- 사업 이름: ${input.name}
- 업종: ${input.category}
- 시작하게 된 계기 / 이야기: ${input.founder_story}
- 주요 고객: ${input.target_customer}
- 가장 큰 장점: ${input.strengths}
- 원하는 브랜드 이미지(톤): ${input.tone}

아래 JSON 스키마로만 응답하세요:
{
  "brand_name": "브랜드 이름 (보통 사업 이름 유지)",
  "headline": "한 줄 대표 헤드라인",
  "slogan": "짧고 기억에 남는 슬로건",
  "short_description": "1~2문장 소개",
  "brand_story": "3~5문단의 진정성 있는 브랜드 스토리",
  "mission": "이 사업의 미션 한 문장",
  "target_customer": "핵심 고객 요약",
  "key_strengths": ["핵심 강점 3개"],
  "brand_keywords": ["브랜드 키워드 5~7개"],
  "tone": "${input.tone}"
}`;

  return { system, user };
}
