import type { SkillPackage } from "./skill";
import type { ComponentNode, PageSchema, Section } from "./pageSchema";

/**
 * 시연용 Skill 패키지 3종 — 카페 / 교육·코칭 / B2B 서비스.
 * 단순 색상 변경이 아니라 섹션·그리드 구조가 확연히 다르게 구성했다.
 * 모두 동일 Page Schema·검증기·렌더러를 사용한다. 가격은 미확정(테스트 데이터).
 */

let sid = 0;
const section = (rows: Section["rows"], layout?: Section["layout"]): Section => ({
  id: `sec_${++sid}`,
  rows,
  layout,
});
const row = (columns: { span: number; components: ComponentNode[] }[]): Section["rows"][number] => ({
  columns,
});
const h = (level: 1 | 2 | 3, text: string, slot?: string): ComponentNode => ({
  type: "heading",
  level,
  text,
  slot,
});
const t = (html: string, slot?: string): ComponentNode => ({ type: "text", html, slot });
const img = (src: string, alt: string, slot?: string): ComponentNode => ({
  type: "image",
  src,
  alt,
  ratio: "16:9",
  slot,
});
const btn = (label: string, slot?: string): ComponentNode => ({
  type: "button",
  label,
  style: "primary",
  slot,
});
const card = (title: string, body: string): ComponentNode => ({ type: "card", title, body });

const DEMO_IMG = "/images/demo/demo-hero.jpg";

// ---------------- 1) 카페 ----------------
const cafeSchema: PageSchema = {
  version: 1,
  tokens: {
    colors: { primary: "#b45309", bg: "#fffaf3", text: "#3f2d1a", soft: "#f6ead8" },
    radius: 16,
    spacingUnit: 8,
  },
  sections: [
    section(
      [row([{ span: 12, components: [img(DEMO_IMG, "카페 전경", "hero_image")] }])],
      { base: { paddingY: 0, maxWidth: 1280 } },
    ),
    section(
      [
        row([
          {
            span: 7,
            components: [
              h(1, "따뜻한 한 잔이 머무는 공간", "hero_title"),
              t("도심 속 작은 로스터리. 직접 볶은 원두로 내리는 드립 커피를 경험하세요.", "hero_desc"),
              btn("오시는 길", "cta_label"),
            ],
          },
          { span: 5, components: [img(DEMO_IMG, "시그니처 메뉴")] },
        ]),
      ],
      { base: { background: "soft", align: "center" } },
    ),
    section([
      row([{ span: 12, components: [h(2, "대표 메뉴")] }]),
      row([
        { span: 4, components: [card("핸드드립", "당일 볶은 싱글오리진")] },
        { span: 4, components: [card("플랫화이트", "진한 에스프레소와 벨벳 밀크")] },
        { span: 4, components: [card("제철 디저트", "매주 바뀌는 홈메이드 베이킹")] },
      ]),
    ]),
    section([row([{ span: 12, components: [h(2, "지금 방문하세요"), btn("예약/문의", "cta_label")] }])], {
      base: { background: "primary", align: "center" },
    }),
  ],
};

export const cafeSkill: SkillPackage = {
  manifest: {
    key: "cafe-warm",
    version: "1.0.0",
    author: "storyup-samples",
    compatSchema: 1,
    languages: ["ko"],
    allowedComponents: ["heading", "text", "image", "button", "card", "spacer", "divider"],
    industry: "카페/F&B",
    tone: "따뜻하고 아늑한",
  },
  tokens: cafeSchema.tokens,
  pageSchema: cafeSchema,
  slots: [
    { key: "hero_image", label: "히어로 이미지", kind: "image", required: true },
    { key: "hero_title", label: "메인 문구", kind: "text", required: true },
    { key: "hero_desc", label: "소개 문구", kind: "richtext" },
    { key: "cta_label", label: "버튼 문구", kind: "text" },
  ],
  sampleContent: {
    hero_title: "따뜻한 한 잔이 머무는 공간",
    hero_desc: "도심 속 작은 로스터리. 직접 볶은 원두로 내리는 드립 커피를 경험하세요.",
    cta_label: "오시는 길",
  },
  checks: { requiredSlots: ["hero_title"] },
};

// ---------------- 2) 교육·코칭 ----------------
const eduSchema: PageSchema = {
  version: 1,
  tokens: {
    colors: { primary: "#1d4ed8", bg: "#ffffff", text: "#0f172a", soft: "#eef2ff" },
    radius: 12,
    spacingUnit: 8,
  },
  sections: [
    section([row([{ span: 12, components: [h(1, "성적이 오르지 않는 진짜 이유", "hero_title"), t("원인을 먼저 찾고, 학생별 계획으로 해결합니다.", "hero_desc"), btn("무료 상담 신청", "cta_label")] }])], {
      base: { background: "soft", align: "center" },
    }),
    section([
      row([{ span: 12, components: [h(2, "문제와 해결")] }]),
      row([
        { span: 6, components: [card("문제", "무엇을 모르는지 모른다")] },
        { span: 6, components: [card("해결", "진단 후 약점만 집중 보완")] },
      ]),
    ]),
    section([
      row([{ span: 12, components: [h(2, "프로그램 비교")] }]),
      row([
        { span: 4, components: [card("베이직", "주 1회 그룹")] },
        { span: 4, components: [card("집중", "주 2회 소수정예")] },
        { span: 4, components: [card("1:1", "맞춤 커리큘럼")] },
      ]),
    ]),
    section([row([{ span: 12, components: [h(2, "진행 과정"), { type: "list", ordered: true, items: ["진단 평가", "학습 계획 수립", "주간 점검", "성과 리포트"] }] }])]),
    section([row([{ span: 12, components: [h(2, "상담 신청"), btn("상담 신청하기", "cta_label")] }])], {
      base: { background: "primary", align: "center" },
    }),
  ],
};

export const eduSkill: SkillPackage = {
  manifest: {
    key: "edu-coaching",
    version: "1.0.0",
    author: "storyup-samples",
    compatSchema: 1,
    languages: ["ko"],
    allowedComponents: ["heading", "text", "image", "button", "card", "list", "spacer", "divider"],
    industry: "교육/코칭",
    tone: "신뢰감 있고 명확한",
  },
  tokens: eduSchema.tokens,
  pageSchema: eduSchema,
  slots: [
    { key: "hero_title", label: "메인 문구", kind: "text", required: true },
    { key: "hero_desc", label: "소개 문구", kind: "richtext" },
    { key: "cta_label", label: "상담 버튼 문구", kind: "text" },
  ],
  sampleContent: {
    hero_title: "성적이 오르지 않는 진짜 이유",
    hero_desc: "원인을 먼저 찾고, 학생별 계획으로 해결합니다.",
    cta_label: "무료 상담 신청",
  },
  checks: { requiredSlots: ["hero_title"] },
};

// ---------------- 3) B2B 서비스 ----------------
const b2bSchema: PageSchema = {
  version: 1,
  tokens: {
    colors: { primary: "#0f766e", bg: "#ffffff", text: "#111827", soft: "#f0fdfa" },
    radius: 10,
    spacingUnit: 8,
  },
  sections: [
    section([
      row([
        { span: 7, components: [h(1, "도입 즉시 성과가 보이는 운영 자동화", "hero_title"), t("반복 업무를 줄이고 데이터로 의사결정하세요.", "hero_desc"), btn("도입 문의", "cta_label")] },
        { span: 5, components: [img(DEMO_IMG, "제품 화면")] },
      ]),
    ], { base: { background: "soft" } }),
    section([
      row([{ span: 12, components: [h(2, "핵심 기능")] }]),
      row([
        { span: 3, components: [card("자동화", "워크플로 자동 실행")] },
        { span: 3, components: [card("분석", "실시간 대시보드")] },
        { span: 3, components: [card("연동", "기존 도구와 연결")] },
        { span: 3, components: [card("보안", "권한·감사 로그")] },
      ]),
    ]),
    section([row([{ span: 12, components: [h(2, "도입 절차"), { type: "list", ordered: true, items: ["요구사항 진단", "파일럿 구축", "교육·온보딩", "운영 전환"] }] }])]),
    section([
      row([{ span: 12, components: [h(2, "자주 묻는 질문")] }]),
      row([
        { span: 6, components: [card("도입 기간은?", "평균 2~4주")] },
        { span: 6, components: [card("기존 시스템 연동?", "API로 연결 가능")] },
      ]),
    ]),
    section([row([{ span: 12, components: [h(2, "도입을 상담하세요"), btn("문의하기", "cta_label")] }])], {
      base: { background: "primary", align: "center" },
    }),
  ],
};

export const b2bSkill: SkillPackage = {
  manifest: {
    key: "b2b-service",
    version: "1.0.0",
    author: "storyup-samples",
    compatSchema: 1,
    languages: ["ko"],
    allowedComponents: ["heading", "text", "image", "button", "card", "list", "spacer", "divider"],
    industry: "B2B 서비스",
    tone: "전문적이고 간결한",
  },
  tokens: b2bSchema.tokens,
  pageSchema: b2bSchema,
  slots: [
    { key: "hero_title", label: "가치 제안", kind: "text", required: true },
    { key: "hero_desc", label: "소개 문구", kind: "richtext" },
    { key: "cta_label", label: "문의 버튼 문구", kind: "text" },
  ],
  sampleContent: {
    hero_title: "도입 즉시 성과가 보이는 운영 자동화",
    hero_desc: "반복 업무를 줄이고 데이터로 의사결정하세요.",
    cta_label: "도입 문의",
  },
  checks: { requiredSlots: ["hero_title"] },
};

export const SAMPLE_SKILLS: Record<string, SkillPackage> = {
  "cafe-warm": cafeSkill,
  "edu-coaching": eduSkill,
  "b2b-service": b2bSkill,
};

export const SAMPLE_SKILL_LIST = [
  { key: "cafe-warm", label: "카페 — 따뜻한 톤" },
  { key: "edu-coaching", label: "교육·코칭 — 상담 중심" },
  { key: "b2b-service", label: "B2B 서비스 — 전환 중심" },
];
