import type { BlogLength, BlogTone } from "@/types/domain";
import { languageRule, type PromptLanguage, type PromptSpec } from "./brand-story";

/**
 * 콘텐츠 품질·정확성·사생활·일관성 수칙 — 검색 품질 점검(2026-10) 결과 반영.
 * AI 생성 글이 반복적으로 범한 문제를 예방한다:
 *  미출처 수치·단정, 개인 식별 사례·낙인 표현, 근거 없는 우위 주장,
 *  도입 약속과 본문 불일치, 제목·설명·본문 불일치, 혜택/쿠폰 조건 누락, 작성자 신뢰(E-E-A-T).
 */
export const CONTENT_QUALITY_RULES_KO = `콘텐츠 품질·정확성 수칙(반드시 준수):
- 사실·수치: 입력에 근거가 없는 통계·비율·증가추세·기간(예: 80~90%, 3~6개월)·순위·시장 단정을 쓰지 않습니다. 근거가 없으면 수치를 빼거나 "경우에 따라" 수준으로 낮추고, 실제 운영에서 관찰한 범위로 한정합니다. 관찰·자기보고·기대효과를 구분해 표현합니다.
- 개인정보·사례: 실제 고객/학생 사례는 학교·정확한 성적·거주/숙박·관계 등 개인을 식별할 수 있는 세부 조합을 넣지 않습니다. 가상의 예시는 "예시"라고 명시합니다. 평가적·낙인성 표현(예: "공부 안 하는")은 피합니다. 동의·익명화는 입력에서 확인된 경우에만 언급합니다.
- 과장·비교: "최고·유일·타 서비스보다 우수" 같은 근거 없는 우위 주장을 넣지 않습니다. 효과를 보장처럼 쓰지 말고 운영 과정·목표로 표현합니다. 지역명만으로 품질·성과를 주장하지 않습니다.
- 약속-본문 일치: 도입에서 "한 주 계획·준비 항목·체크리스트" 등을 약속하면 본문에 반드시 그 항목을 실제로 제공합니다. 넣지 못할 내용은 도입에서도 약속하지 않습니다. 가능하면 독자가 바로 쓸 단계·체크리스트·예시(실제/가상 구분)를 하나 이상 포함합니다.
- 제목·설명·본문 일치: title·seo_title·seo_description·social_caption·image_subject·본문이 모두 같은 주제와 대상(자산·메뉴·지역 등)을 가리키게 합니다. 서로 다른 소재를 섞지 않습니다.
- 혜택·쿠폰·추천: 쿠폰·혜택·추천(ref) 링크를 언급할 때 대상·사용기간·차감/지급 방식·개인정보 처리 등 조건을 입력에서 확인된 범위에서만 명확히 쓰고, 확인되지 않으면 단정하지 않습니다.
- 작성자(E-E-A-T): 작성자·상담자의 역할·경력은 입력에서 확인된 범위에서만 쓰고 지어내지 않습니다.`;

/**
 * 사람이 쓴 듯 자연스러운 글쓰기(AI 글투 제거) 수칙.
 * sepia(de-AI writing skill, github.com/Nanako0129/sepia)의 원칙을 한국어
 * 블로그에 맞게 변환: 문장 리듬 다양화, 상투적 도입/마무리 제거, 과장어 억제,
 * 구체성, 분명한 관점, 요약식 엔딩 회피. 위 정확성 수칙(지어내지 않기)이 항상 우선.
 */
export const HUMAN_WRITING_RULES_KO = `사람이 직접 쓴 듯 자연스럽게(AI 글투 제거) — 다음을 지킵니다:
- 문장 길이를 일부러 들쭉날쭉하게. 짧은 문장과 긴 문장을 섞고, 모든 문단을 비슷한 길이·구조로 찍어내지 않습니다.
- 상투적 AI 도입·마무리 금지: "요즘 ~가 화두입니다", "~에 대해 알아보겠습니다", "결론적으로", "요약하자면" 같은 틀로 기계적으로 열고 닫지 않습니다. 글은 문제·상황에서 바로 시작하고, 마지막을 요약 반복으로 끝내지 않습니다.
- 공허한 수식·과장어 줄이기: "완벽한·최고의·혁신적인·손쉽게·다양한·특별한" 같은 빈 형용사를 남발하지 말고 구체적인 명사·동사로 바꿉니다.
- 다 설명하지 않기: 당연한 배경·교과서식 정의는 빼고, 실제로 도움이 되는 구체(숫자는 조건과 함께, 실제 겪은 과정이나 막혔던 지점 하나)를 넣습니다.
- 나열·대칭 강박 피하기: "첫째/둘째/셋째", 무조건 3개씩 묶기, 좌우 대칭 문장 구조의 반복을 피합니다.
- 한 가지 분명한 관점(의견)을 담고, 양쪽 다 맞다는 식의 무난한 마무리로 끝내지 않습니다.
- 독자 호칭·구호·느낌표·이모지 남발 금지("여러분", "~해보세요"의 기계적 반복 포함).
- 일반명사로 뭉개지 말고 실제 대상·고유한 이름을 씁니다. 단, 없는 사실을 지어내지는 않습니다(위 정확성 수칙 우선).`;

export interface BlogPromptInput {
  businessName: string;
  category: string;
  brandTone: string;
  topic: string;
  tone: BlogTone;
  length: BlogLength;
  language?: PromptLanguage;
}

const LENGTH_GUIDE_KO: Record<BlogLength, string> = {
  Short: "약 400~600자, 3~4문단",
  Medium: "약 800~1200자, 5~7문단, 소제목 2~3개",
  Long: "약 1500~2000자, 소제목 4개 이상, 도입/본문/마무리 구성",
};

const LENGTH_GUIDE_EN: Record<BlogLength, string> = {
  Short: "about 250-400 words, 3-4 paragraphs",
  Medium: "about 500-800 words, 5-7 paragraphs, 2-3 subheadings",
  Long: "about 900-1300 words, 4+ subheadings, intro/body/closing structure",
};

export interface BlogTranscriptPromptInput {
  businessName: string;
  category: string;
  brandTone: string;
  transcript: string;
  tone: BlogTone;
  length: BlogLength;
  language?: PromptLanguage;
}

/** 음성 녹음 전사문을 블로그 글로 재구성한다 (말한 내용만 사용, 창작 금지). */
export function blogFromTranscriptPrompt(
  input: BlogTranscriptPromptInput,
): PromptSpec {
  const language = input.language ?? "ko";
  const lengthGuide =
    language === "en" ? LENGTH_GUIDE_EN[input.length] : LENGTH_GUIDE_KO[input.length];
  const system = `당신은 소상공인이 말로 녹음한 내용을 블로그 글로 다듬어주는 전문 카피라이터입니다.
${languageRule(language)}
규칙:
- 전사문에서 말한 내용과 사실만 사용하고, 없는 정보(가격·날짜·효능 등)를 지어내지 않습니다.
- 구어체의 군더더기·반복·추임새를 정리하고 자연스러운 문어체로 바꿉니다.
- 말한 순서에 얽매이지 말고 독자가 읽기 좋은 흐름(도입-본문-마무리)으로 재구성합니다.
- content 는 Markdown 형식(##, **, - 목록 사용)으로 작성합니다.
${CONTENT_QUALITY_RULES_KO}
${HUMAN_WRITING_RULES_KO}
반드시 아래 JSON 스키마만 순수 JSON으로 반환하세요.`;

  const user = `사업 정보:
- 사업 이름: ${input.businessName}
- 업종: ${input.category}
- 브랜드 톤: ${input.brandTone}

사장님이 말로 녹음한 내용(전사문):
"""
${input.transcript.slice(0, 8000)}
"""

작성 요청:
- 글의 톤: ${input.tone}
- 분량: ${input.length} (${lengthGuide}) — 단, 전사문 내용이 짧으면 억지로 늘리지 말 것

아래 JSON 스키마로만 응답하세요:
{
  "title": "매력적인 블로그 제목",
  "summary": "1~2문장 요약",
  "content": "Markdown 본문",
  "keywords": ["SEO 키워드 5개"],
  "seo_title": "60자 이내 SEO 제목",
  "seo_description": "150자 이내 메타 설명",
  "social_caption": "SNS 공유용 짧은 캡션",
  "image_subject": "커버 이미지 장면 묘사 (영어 한 문장). 이 글의 핵심 메시지·주제를 시각적으로 전달하는 구체적인 장면이나 상징적인 사물을 업종 맥락에 맞게 묘사하세요. 제목만 보고 뻔한 소품을 나열하지 말고 글이 말하려는 바를 담을 것. 사람·손·글자·숫자는 넣지 말고, 일반적인 사무실·빈 책상·흩어진 문구류 같은 상투적 구도는 피하세요. 예: a quiet tutoring study corner where a small plant grows beside neatly stacked books in warm sunlight, conveying steady academic growth"
}`;

  return { system, user };
}

export interface BlogExpandPromptInput {
  businessName: string;
  category: string;
  title: string;
  /** 보강할 단락 원문 */
  paragraph: string;
  /** 글 전체(또는 요약) — 흐름 유지를 위한 참고 맥락 */
  fullContext?: string;
  language?: PromptLanguage;
}

/** 초안 본문의 한 단락을 자연스럽게 이어 2~4문장 더 작성한다 (앞 문장 반복 금지). */
export function blogExpandPrompt(input: BlogExpandPromptInput): PromptSpec {
  const language = input.language ?? "ko";
  const system = `당신은 소상공인의 블로그 글을 더 풍부하게 다듬어주는 전문 카피라이터입니다.
${languageRule(language)}
규칙:
- 주어진 "단락"의 흐름과 톤을 유지하며 자연스럽게 이어지는 2~4문장을 새로 씁니다.
- 단락에 이미 있는 문장을 반복하지 않고, 구체적 예시·부연·실질적 정보를 더합니다.
- 없는 사실(가격·수치·효능·날짜·통계·순위 등)을 지어내지 않습니다. 근거 없는 수치·우위 주장·보장성 표현을 넣지 않습니다.
- 개인을 식별할 수 있는 사례 세부(학교·정확한 성적·거주·관계 등)나 낙인성 표현을 추가하지 않습니다.
- Markdown 본문 문장만 작성하고, 소제목(##)·목록·이미지는 넣지 않습니다.
- AI 글투를 피합니다: 문장 길이를 섞고 상투적 수식어·요약·구호 없이 구체적으로 이어씁니다.
반드시 {"text": "..."} 형태의 순수 JSON만 반환하세요.`;

  const user = `사업: ${input.businessName} (${input.category})
글 제목: ${input.title}
${
  input.fullContext
    ? `글 전체 맥락(참고용):\n"""\n${input.fullContext.slice(0, 1500)}\n"""\n`
    : ""
}보강할 단락:
"""
${input.paragraph.slice(0, 1500)}
"""

이 단락 뒤에 자연스럽게 이어질 2~4문장을 작성해 {"text": "..."} JSON으로만 응답하세요.`;

  return { system, user };
}

export function blogPrompt(input: BlogPromptInput): PromptSpec {
  const language = input.language ?? "ko";
  const lengthGuide =
    language === "en" ? LENGTH_GUIDE_EN[input.length] : LENGTH_GUIDE_KO[input.length];
  const system = `당신은 소상공인의 블로그 콘텐츠를 대신 써주는 전문 카피라이터입니다.
독자에게 실질적으로 도움이 되고 자연스럽게 읽히는 글을 씁니다.
${languageRule(language)}
content 는 Markdown 형식(##, **, - 목록 사용)으로 작성합니다.
${CONTENT_QUALITY_RULES_KO}
${HUMAN_WRITING_RULES_KO}
반드시 아래 JSON 스키마만 순수 JSON으로 반환하세요.`;

  const user = `사업 정보:
- 사업 이름: ${input.businessName}
- 업종: ${input.category}
- 브랜드 톤: ${input.brandTone}

작성 요청:
- 주제: ${input.topic}
- 글의 톤: ${input.tone}
- 분량: ${input.length} (${lengthGuide})

아래 JSON 스키마로만 응답하세요:
{
  "title": "매력적인 블로그 제목",
  "summary": "1~2문장 요약",
  "content": "Markdown 본문",
  "keywords": ["SEO 키워드 5개"],
  "seo_title": "60자 이내 SEO 제목",
  "seo_description": "150자 이내 메타 설명",
  "social_caption": "SNS 공유용 짧은 캡션",
  "image_subject": "커버 이미지 장면 묘사 (영어 한 문장). 이 글의 핵심 메시지·주제를 시각적으로 전달하는 구체적인 장면이나 상징적인 사물을 업종 맥락에 맞게 묘사하세요. 제목만 보고 뻔한 소품을 나열하지 말고 글이 말하려는 바를 담을 것. 사람·손·글자·숫자는 넣지 말고, 일반적인 사무실·빈 책상·흩어진 문구류 같은 상투적 구도는 피하세요. 예: a quiet tutoring study corner where a small plant grows beside neatly stacked books in warm sunlight, conveying steady academic growth"
}`;

  return { system, user };
}
