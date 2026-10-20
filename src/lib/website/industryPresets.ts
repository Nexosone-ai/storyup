import type {
  SiteSection,
  WebsiteTemplateId,
  WebsitePaletteId,
  WebsiteFontId,
} from "@/types/domain";

/**
 * 업종별 '블로그 연동 전문 홈페이지' 프리셋 — 한 번에 레이아웃(템플릿·팔레트·폰트) +
 * 블로그 연결 섹션 골격을 깐다. 글은 저장하지 않고(바인딩 규칙만) 런타임에 연결된다.
 * 브랜드 소개(hero)와 상담 CTA는 고정 영역으로 포함한다.
 */
export interface IndustryPreset {
  key: string;
  label: string;
  description: string;
  template: WebsiteTemplateId;
  palette: WebsitePaletteId;
  font: WebsiteFontId;
  build: (ko: boolean) => SiteSection[];
}

const t = (ko: boolean, k: string, e: string) => (ko ? k : e);

export const INDUSTRY_PRESETS: IndustryPreset[] = [
  {
    key: "cafe",
    label: "카페·매장",
    description: "따뜻한 매거진 톤 — 대표 이야기 + 소식",
    template: "warm",
    palette: "terracotta",
    font: "gowun",
    build: (ko) => [
      {
        type: "hero",
        title: t(ko, "따뜻한 하루를 드리는 공간", "A warm place for your day"),
        subtitle: t(ko, "오늘의 이야기와 메뉴를 전해드려요.", "Today's stories and menu."),
        ctaLabel: t(ko, "방문 예약", "Reserve a visit"),
      },
      {
        type: "blogSection",
        title: t(ko, "우리 가게 이야기", "Our stories"),
        layout: "spotlight",
        binding: { source: "latest", count: 4, sort: "recent" },
      },
      {
        type: "features",
        title: t(ko, "이런 점이 특별해요", "What makes us special"),
        items: [
          { title: t(ko, "정성 가득한 메뉴", "Crafted menu"), description: t(ko, "매일 준비하는 신선한 메뉴.", "Fresh, made daily.") },
          { title: t(ko, "편안한 공간", "Cozy space"), description: t(ko, "머무르고 싶은 분위기.", "A place to linger.") },
          { title: t(ko, "동네 단골의 사랑", "Loved by locals"), description: t(ko, "꾸준히 찾아주시는 이유.", "Why regulars return.") },
        ],
      },
      {
        type: "blogSection",
        title: t(ko, "새 소식·이벤트", "News & events"),
        layout: "magazine",
        binding: { source: "latest", count: 6, sort: "recent" },
      },
      {
        type: "cta",
        title: t(ko, "오늘 들러보세요", "Drop by today"),
        body: t(ko, "궁금한 점은 편하게 문의해주세요.", "Reach out anytime."),
        ctaLabel: t(ko, "문의하기", "Contact us"),
      },
    ],
  },
  {
    key: "education",
    label: "교육·코칭",
    description: "신뢰감 있는 미니멀 — 가이드 + 칼럼·후기",
    template: "minimal",
    palette: "ocean",
    font: "serif",
    build: (ko) => [
      {
        type: "hero",
        title: t(ko, "성장을 돕는 교육 파트너", "Your learning partner"),
        subtitle: t(ko, "검증된 방법으로 함께 목표에 도달해요.", "Reach your goals with proven methods."),
        ctaLabel: t(ko, "무료 상담 신청", "Book a free consult"),
      },
      {
        type: "blogSection",
        title: t(ko, "학습 가이드", "Learning guides"),
        layout: "feature",
        binding: { source: "latest", count: 3, sort: "recent" },
      },
      {
        type: "steps",
        title: t(ko, "수업은 이렇게 진행돼요", "How it works"),
        items: [
          { title: t(ko, "진단", "Assess"), description: t(ko, "현재 수준을 파악해요.", "Understand your level.") },
          { title: t(ko, "계획", "Plan"), description: t(ko, "맞춤 커리큘럼을 설계해요.", "Build a custom plan.") },
          { title: t(ko, "학습", "Learn"), description: t(ko, "꾸준히 실력을 쌓아요.", "Grow steadily.") },
          { title: t(ko, "점검", "Review"), description: t(ko, "성과를 확인하고 보완해요.", "Check and refine.") },
        ],
      },
      {
        type: "blogSection",
        title: t(ko, "칼럼·합격 후기", "Columns & reviews"),
        layout: "list",
        binding: { source: "latest", count: 8, sort: "recent" },
      },
      {
        type: "cta",
        title: t(ko, "지금 시작해볼까요?", "Ready to start?"),
        body: t(ko, "상담은 무료예요.", "Consultation is free."),
        ctaLabel: t(ko, "상담 신청", "Request a consult"),
      },
    ],
  },
  {
    key: "b2b",
    label: "B2B 서비스",
    description: "모던·테크 — 인사이트 + 고객 사례",
    template: "modern",
    palette: "charcoal",
    font: "default",
    build: (ko) => [
      {
        type: "hero",
        title: t(ko, "비즈니스 성장을 위한 솔루션", "Solutions that scale your business"),
        subtitle: t(ko, "현장에서 검증된 전문성으로 함께합니다.", "Proven expertise, delivered."),
        ctaLabel: t(ko, "도입 문의", "Request a demo"),
      },
      {
        type: "features",
        title: t(ko, "핵심 가치", "Core value"),
        items: [
          { title: t(ko, "전문성", "Expertise"), description: t(ko, "축적된 노하우로 해결해요.", "Deep domain know-how.") },
          { title: t(ko, "신뢰", "Reliability"), description: t(ko, "안정적인 운영과 지원.", "Stable ops and support.") },
          { title: t(ko, "성과", "Results"), description: t(ko, "측정 가능한 결과를 만들어요.", "Measurable outcomes.") },
        ],
      },
      {
        type: "blogSection",
        title: t(ko, "인사이트·자료", "Insights & resources"),
        layout: "magazine",
        binding: { source: "latest", count: 6, sort: "recent" },
      },
      {
        type: "stats",
        title: t(ko, "숫자로 보는 성과", "By the numbers"),
        items: [
          { value: "98%", label: t(ko, "고객 만족", "Satisfaction") },
          { value: "24/7", label: t(ko, "지원", "Support") },
          { value: "10+", label: t(ko, "업력(년)", "Years") },
          { value: "100+", label: t(ko, "도입 고객", "Clients") },
        ],
      },
      {
        type: "blogSection",
        title: t(ko, "고객 사례", "Case studies"),
        layout: "cards",
        binding: { source: "latest", count: 6, sort: "recent" },
      },
      {
        type: "cta",
        title: t(ko, "도입을 검토 중이신가요?", "Considering us?"),
        body: t(ko, "맞춤 상담을 도와드려요.", "We'll tailor a plan for you."),
        ctaLabel: t(ko, "도입 문의", "Contact sales"),
      },
    ],
  },
];
