import type { BrandStoryResult, BusinessInterviewInput } from "@/types/domain";
import { languageRule, type PromptLanguage, type PromptSpec } from "./brand-story";

export function websitePrompt(
  business: BusinessInterviewInput,
  brand: BrandStoryResult,
  language: PromptLanguage = "ko",
): PromptSpec {
  const system = `당신은 소상공인용 홈페이지 카피라이터입니다.
브랜드 정보를 바탕으로 미리 정의된 템플릿 섹션에 들어갈 문구를 작성합니다.
과장 없이, 방문객이 신뢰할 수 있는 자연스러운 카피를 씁니다.
${languageRule(language)}
반드시 아래 JSON 스키마만 순수 JSON으로 반환하세요.`;

  const user = `사업/브랜드 정보:
- 사업 이름: ${brand.brand_name || business.name}
- 업종: ${business.category}
- 헤드라인: ${brand.headline}
- 슬로건: ${brand.slogan}
- 소개: ${brand.short_description}
- 브랜드 스토리: ${brand.brand_story}
- 미션: ${brand.mission}
- 핵심 강점: ${brand.key_strengths.join(", ")}
- 고객: ${brand.target_customer}

아래 JSON 스키마로만 응답하세요. offers.items 와 whyChooseUs.items 는 각각 정확히 3개입니다.
{
  "hero": {
    "businessName": "${brand.brand_name || business.name}",
    "headline": "히어로 헤드라인",
    "shortDescription": "히어로 하단 1~2문장",
    "ctaLabel": "행동 유도 버튼 문구 (예: 문의하기)"
  },
  "story": { "title": "Our Story", "body": "브랜드 스토리 요약 2~3문단" },
  "offers": {
    "title": "What We Offer",
    "items": [
      { "title": "상품/서비스 1", "description": "설명" },
      { "title": "상품/서비스 2", "description": "설명" },
      { "title": "상품/서비스 3", "description": "설명" }
    ]
  },
  "whyChooseUs": {
    "title": "Why Choose Us",
    "items": [
      { "title": "경쟁력 1", "description": "설명" },
      { "title": "경쟁력 2", "description": "설명" },
      { "title": "경쟁력 3", "description": "설명" }
    ]
  },
  "contact": {
    "phone": "",
    "email": "",
    "address": "",
    "instagram": "",
    "website": ""
  }
}`;

  return { system, user };
}
