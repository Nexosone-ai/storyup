import type { WebsiteContent, SiteSection, SitePage } from "@/types/domain";

/**
 * 판매/재사용용 '홈페이지 디자인 템플릿' — 디자인(템플릿·팔레트·폰트·구조) + 블로그
 * '추상 바인딩 규칙'만 남기고 판매자 고유 데이터는 전부 제거한다.
 * 제거 대상(판매자 유출 방지): 사업장명·연락처(PII)·업로드 이미지/로고·갤러리·배너·
 * AdSense 퍼블리셔ID·블로그 수동/고정/제외 글 slug(= 판매자의 실제 글). businessId는
 * 애초에 저장하지 않는다. 구매자가 설치하면 바인딩이 '구매자 자신의 블로그'로 연결된다.
 */

function stripSection(s: SiteSection): SiteSection {
  // 공통: 섹션 배경/대표 이미지 제거.
  const base = { ...s, image: undefined } as SiteSection;
  if (base.type === "slider")
    return { ...base, items: base.items.map((it) => ({ ...it, image: undefined })) };
  if (base.type === "features" || base.type === "pricing" || base.type === "steps")
    return base; // 텍스트 샘플 유지(이미지 필드 없음)
  if (base.type === "blogSection")
    // 바인딩에서 판매자 실제 글(slug)만 제거하고 추상 규칙(소스·카테고리·개수·정렬)만 남김.
    return {
      ...base,
      binding: {
        source: base.binding.source ?? "latest",
        category: base.binding.category,
        count: base.binding.count,
        sort: base.binding.sort,
      },
    };
  return base;
}

function stripCardImages<T extends { items: { image?: string }[] }>(group: T): T {
  return { ...group, items: group.items.map((i) => ({ ...i, image: undefined })) };
}

function stripPage(p: SitePage): SitePage {
  return {
    ...p,
    hero: p.hero ? { ...p.hero, image: undefined } : p.hero,
    sections: (p.sections ?? []).map(stripSection),
  };
}

/** WebsiteContent → 판매/재사용 가능한 디자인 템플릿(판매자 데이터 제거). */
export function toHomepageTemplate(content: WebsiteContent): WebsiteContent {
  return {
    template: content.template,
    language: content.language,
    style: content.style,
    hero: {
      businessName: "", // 설치 시 구매자 사업장명으로 채움
      headline: content.hero.headline,
      shortDescription: content.hero.shortDescription,
      ctaLabel: content.hero.ctaLabel,
      ctaHref: undefined, // 판매자 링크 제거
      image: undefined,
      logo: undefined, // 판매자 로고 제거
    },
    story: content.story,
    offers: stripCardImages(content.offers),
    whyChooseUs: stripCardImages(content.whyChooseUs),
    contact: { phone: "", email: "", address: "", instagram: "", website: "" }, // PII 제거
    sections: (content.sections ?? []).map(stripSection),
    sectionOrder: content.sectionOrder,
    hiddenSections: content.hiddenSections,
    pages: (content.pages ?? []).map(stripPage),
    // banners·gallery·adsense: 판매자 고유 → 템플릿에 포함하지 않음.
  };
}

/**
 * 템플릿을 구매자 사업장에 적용할 콘텐츠로 변환 — 사업장명만 채운다.
 * 블로그 바인딩은 slug가 없어 구매자의 공개 글(최신/카테고리)로 자동 연결된다.
 * 설치는 항상 초안(status=draft)으로 저장(호출부가 처리).
 */
export function applyHomepageTemplate(
  template: WebsiteContent,
  businessName: string,
): WebsiteContent {
  return {
    ...template,
    hero: { ...template.hero, businessName: businessName || template.hero.businessName },
  };
}
