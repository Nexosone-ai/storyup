import { languageRule, type PromptLanguage, type PromptSpec } from "./brand-story";

export interface StrategyMetrics {
  periodLabel: string; // 예: "최근 30일"
  visits: number;
  visitsGrowthPct: number;
  leads: number;
  leadsGrowthPct: number;
  blogPublished: number;
  couponIssued: number;
  couponUsageRate: number; // 0~100
  topReferrer: string | null;
}

export interface MarketingStrategyPromptInput {
  businessName: string;
  category: string;
  brandTone: string;
  metrics: StrategyMetrics;
  language?: PromptLanguage;
}

export function marketingStrategyPrompt(
  input: MarketingStrategyPromptInput,
): PromptSpec {
  const language = input.language ?? "ko";
  const m = input.metrics;
  const system = `당신은 소상공인의 온라인 마케팅을 돕는 데이터 기반 전략가입니다.
주어진 성과 지표를 해석해 이번 기간에 실행할 구체적이고 현실적인 마케팅 액션을 제안합니다.
${languageRule(language)}
- 추상적 조언 금지. 이 사업이 STORYUP에서 할 수 있는 실제 행동(블로그 글 주제, 쿠폰 이벤트, SNS 공유, 랜딩페이지 개선 등)으로 제안하세요.
- 각 액션에는 지표 근거(reason)와 구체적 실행법(how)을 담으세요.
- actions는 우선순위 순 3~5개.
반드시 아래 JSON 스키마만 순수 JSON으로 반환하세요.`;

  const user = `사업 이름: ${input.businessName}
업종: ${input.category}
브랜드 톤: ${input.brandTone}

[성과 지표 · ${m.periodLabel}]
- 방문: ${m.visits} (직전 대비 ${m.visitsGrowthPct >= 0 ? "+" : ""}${m.visitsGrowthPct}%)
- 신규 리드(문의·쿠폰): ${m.leads} (직전 대비 ${m.leadsGrowthPct >= 0 ? "+" : ""}${m.leadsGrowthPct}%)
- 블로그 발행: ${m.blogPublished}건
- 쿠폰: ${m.couponIssued}건 발행, 사용률 ${m.couponUsageRate}%
- 주요 유입: ${m.topReferrer ?? "직접 유입 위주"}

위 지표를 바탕으로 아래 JSON 스키마로만 응답하세요:
{
  "summary": "현재 성과 한줄 요약",
  "focus": "이번 기간 가장 집중할 한 가지",
  "actions": [
    { "title": "실행 항목", "reason": "지표 근거", "how": "구체적 실행 방법" }
  ]
}`;

  return { system, user };
}
