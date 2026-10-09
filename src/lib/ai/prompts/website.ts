import type { BrandStoryResult, BusinessInterviewInput } from "@/types/domain";
import { languageRule, type PromptLanguage, type PromptSpec } from "./brand-story";

export function websitePrompt(
  business: BusinessInterviewInput,
  brand: BrandStoryResult,
  language: PromptLanguage = "ko",
): PromptSpec {
  const system = `당신은 소상공인용 랜딩페이지 카피라이터입니다.
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

/**
 * (프리미엄) 상세 홈페이지 생성 — 브랜드 + 사용자가 입력한 자료(brief)로
 * 기존 고정 섹션에 더해 풍부한 가변 섹션(sections[])과 비주얼 컨셉
 * (template/palette/font)까지 함께 생성한다. 반환은 순수 JSON(WebsiteContent 형태).
 */
export function richHomepagePrompt(
  business: BusinessInterviewInput,
  brand: BrandStoryResult,
  brief: string,
  language: PromptLanguage = "ko",
): PromptSpec {
  const system = `당신은 소상공인용 "홈페이지"를 설계하는 웹 디렉터 겸 카피라이터입니다.
브랜드 정보와 사장님이 제공한 자료를 바탕으로, 진짜 홈페이지처럼 풍부한 한 페이지를 구성합니다.
- 자료에 없는 사실(가격·수치·후기·효능 등)은 지어내지 않습니다. 자료에 가격이 없으면 pricing 섹션을 넣지 않습니다.
- 업종·톤에 어울리는 비주얼 컨셉(template/palette/font)을 직접 고릅니다.
- 섹션은 내용이 있는 것만, 자연스러운 순서로 배치합니다(불필요한 빈 섹션 금지).
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
- 톤: ${brand.tone}

사장님이 제공한 상세 자료(이 내용을 적극 활용해 섹션을 구성):
"""
${brief.slice(0, 6000)}
"""

컨셉 선택지:
- template: classic | split | minimal | bold | elegant | vibrant | magazine | warm | modern
- palette: forest | ocean | plum | terracotta | rose | charcoal | sky | mint | lavender | pink | peach
- font: default | noto-sans | serif | gowun

sections 배열은 아래 유형 중 내용에 맞는 것만 골라 넣습니다(가변 개수, 최대 8개). 각 유형 형태:
- {"type":"features","title":"...","subtitle":"(선택)","items":[{"title":"...","description":"..."}]}  // 서비스/특징
- {"type":"pricing","title":"...","items":[{"name":"...","price":"...","description":"(선택)","features":["..."],"highlighted":false}]}  // 자료에 가격이 있을 때만
- {"type":"steps","title":"...","items":[{"title":"...","description":"..."}]}  // 이용 절차
- {"type":"faq","title":"자주 묻는 질문","items":[{"q":"...","a":"..."}]}
- {"type":"testimonials","title":"고객 후기","items":[{"quote":"...","author":"...","role":"(선택)"}]}  // 자료에 후기가 있을 때만
- {"type":"stats","title":"(선택)","items":[{"value":"...","label":"..."}]}  // 자료에 수치가 있을 때만
- {"type":"cta","title":"...","body":"(선택)","ctaLabel":"(선택)"}
- {"type":"richText","title":"...","body":"여러 문단 가능"}

아래 JSON으로만 응답하세요. offers.items 와 whyChooseUs.items 는 각각 정확히 3개입니다.
{
  "template": "컨셉에 맞는 template 하나",
  "style": { "palette": "palette 하나", "font": "font 하나" },
  "hero": {
    "businessName": "${brand.brand_name || business.name}",
    "headline": "히어로 헤드라인",
    "shortDescription": "히어로 하단 1~2문장",
    "ctaLabel": "행동 유도 버튼 문구"
  },
  "story": { "title": "Our Story", "body": "브랜드 스토리 2~3문단" },
  "offers": { "title": "What We Offer", "items": [ {"title":"","description":""}, {"title":"","description":""}, {"title":"","description":""} ] },
  "whyChooseUs": { "title": "Why Choose Us", "items": [ {"title":"","description":""}, {"title":"","description":""}, {"title":"","description":""} ] },
  "sections": [ /* 위 유형들 중 자료에 맞는 것들 */ ],
  "contact": { "phone": "", "email": "", "address": "", "instagram": "", "website": "" }
}`;

  return { system, user };
}

/**
 * (프리미엄) 멀티페이지 홈페이지 생성 — 홈(위 richHomepage와 동일) + 추가 페이지(pages[]).
 * AI가 자료를 보고 어떤 하위 페이지가 필요한지(소개·서비스·요금·오시는길 등) 직접 정해
 * 각 페이지의 섹션까지 구성한다. 반환은 순수 JSON(WebsiteContent + pages).
 */
export function multiPagePrompt(
  business: BusinessInterviewInput,
  brand: BrandStoryResult,
  brief: string,
  language: PromptLanguage = "ko",
): PromptSpec {
  const base = richHomepagePrompt(business, brand, brief, language);
  const system = `${base.system}
추가로, 사장님의 자료가 충분하면 홈 외 하위 페이지(pages)를 2~4개 구성합니다.
- 흔한 예: 소개(about), 서비스/메뉴(services), 요금(pricing), 오시는 길·문의(contact). 자료에 맞는 것만.
- 각 페이지는 상단 메뉴에 노출될 짧은 navLabel과 영문 slug(about/services/pricing 등), 선택적 hero, 그리고 섹션(sections, 홈과 같은 유형)으로 구성합니다.
- 홈에 모든 내용을 몰아넣지 말고, 성격이 다른 묶음을 페이지로 분리해 "진짜 홈페이지"처럼 만드세요. 자료가 부족하면 pages는 비워도 됩니다.`;

  const user = `${base.user}

위 JSON에 더해, 최상위에 "pages" 배열을 함께 포함하세요(없으면 빈 배열). 각 페이지 형태:
{
  "slug": "about",                     // 영문 소문자-하이픈 (blog 등 예약어 금지)
  "navLabel": "소개",                   // 상단 메뉴 표기(짧게)
  "showInNav": true,
  "hero": { "headline": "...", "shortDescription": "(선택)", "ctaLabel": "(선택)" },
  "sections": [ /* 홈과 같은 섹션 유형들 */ ]
}
pages는 최대 4개. 자료에 없는 내용은 만들지 마세요.`;

  return { system, user };
}
