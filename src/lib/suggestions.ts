import type { getAnalytics, getCustomerInsights } from "@/lib/analytics";

/**
 * 규칙 기반 맞춤 제안 — 방문·쿠폰·리드 지표를 보고 다음 액션을 제안한다.
 * (기존 애널리틱스의 '맞춤 제안'을 공용화 — 이제 AI 전략 화면에서만 노출한다.)
 */
type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
type Insights = Awaited<ReturnType<typeof getCustomerInsights>>;

export function buildMarketingSuggestions(
  data: Analytics,
  insights: Insights,
  ko: boolean,
): string[] {
  const { coupon, leads } = insights;
  const tips: string[] = [];

  if (coupon.issued === 0)
    tips.push(
      ko
        ? "아직 쿠폰 이벤트가 없어요. 블로그 글에 쿠폰을 달면 방문자의 이름·연락처를 모아 단골로 만들 수 있어요."
        : "No coupon events yet. Add a coupon to a blog post to collect visitors' names and contacts.",
    );
  if (coupon.issued > 0 && coupon.usageRate < 30)
    tips.push(
      ko
        ? `쿠폰 사용률이 ${coupon.usageRate}%로 낮아요. 사용 기간을 늘리거나 혜택을 강화하고, 발급 고객에게 안내 문자를 보내보세요.`
        : `Coupon usage is only ${coupon.usageRate}%. Extend the validity or boost the benefit, and remind claimants.`,
    );
  if (coupon.byPost[0])
    tips.push(
      ko
        ? `‘${coupon.byPost[0].title}’ 글에서 쿠폰이 가장 많이 발행됐어요(${coupon.byPost[0].issued}건). 비슷한 주제의 글을 더 써보세요.`
        : `‘${coupon.byPost[0].title}’ issued the most coupons (${coupon.byPost[0].issued}). Write more on similar topics.`,
    );
  if (leads.growthPct < 0)
    tips.push(
      ko
        ? "최근 신규 고객이 줄고 있어요. 새 쿠폰 이벤트를 열거나 블로그 글을 발행해 유입을 늘려보세요."
        : "New customers are declining. Launch a new coupon event or publish a post to drive traffic.",
    );
  else if (leads.new30d > 0)
    tips.push(
      ko
        ? `최근 30일 신규 고객이 ${leads.new30d}명이에요(${leads.growthPct >= 0 ? "+" : ""}${leads.growthPct}%). 이 흐름을 이어가세요.`
        : `${leads.new30d} new customers in 30 days (${leads.growthPct >= 0 ? "+" : ""}${leads.growthPct}%). Keep it up.`,
    );
  if (data.viewsGrowthPct < 0)
    tips.push(
      ko
        ? "방문이 감소 추세예요. 새 블로그 글과 SNS 공유로 유입 경로를 넓혀보세요."
        : "Visits are trending down. Add new posts and share on social to widen your reach.",
    );
  if (data.shares30d === 0 && data.views30d > 0)
    tips.push(
      ko
        ? "공유가 아직 없어요. 글 하단 공유 버튼을 눌러 직접 퍼뜨려 보세요."
        : "No shares yet. Use the share buttons under your posts to spread the word.",
    );

  return tips.slice(0, 5);
}
