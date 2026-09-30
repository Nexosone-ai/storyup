"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { getAnalytics, getCustomerInsights } from "@/lib/analytics";
import { getBlogPosts } from "@/lib/queries";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import type { MarketingStrategyResult } from "@/types/domain";

export interface StrategyActionResult {
  result?: MarketingStrategyResult;
  error?: string;
}

/** 사용 분석 기반 AI 마케팅 전략 생성 — Basic 월 1회, Pro 상시. */
export async function generateStrategyAction(
  businessId: string,
): Promise<StrategyActionResult> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const planId = await getPlanId(user.id);
  const plan = getPlanById(planId);
  if (!plan.aiStrategy)
    return {
      error: ko
        ? "AI 마케팅 전략은 Basic 이상 플랜에서 사용할 수 있어요."
        : "AI marketing strategy is available on Basic and higher.",
    };

  // 소유 사업장 확인
  const { data: biz } = await supabase
    .from("businesses")
    .select("id, name, category, tone")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz)
    return { error: ko ? "사업장을 찾을 수 없습니다." : "Business not found." };

  // Basic은 월 1회 — 이번 달(KST) 생성 이력이 있으면 차단. Pro/Partner는 상시.
  const unlimited = planId === "pro" || planId === "partner";
  if (!unlimited) {
    const { data: last } = await supabase
      .from("marketing_strategies")
      .select("created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last) {
      const kstMonth = (d: Date) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
        }).format(d);
      if (kstMonth(new Date(last.created_at)) === kstMonth(new Date()))
        return {
          error: ko
            ? "이번 달 전략은 이미 생성했어요. (Basic 월 1회 · Pro는 상시 생성)"
            : "This month's strategy was already generated. (Basic: once/month; Pro: unlimited)",
        };
    }
  }

  // 지표 수집
  const [analytics, insights, posts] = await Promise.all([
    getAnalytics(businessId),
    getCustomerInsights(businessId),
    getBlogPosts(businessId),
  ]);
  const blogPublished = posts.filter((p) => p.status === "published").length;

  let result: MarketingStrategyResult;
  try {
    result = await getAIProvider().generateMarketingStrategy({
      businessName: biz.name,
      category: biz.category,
      brandTone: biz.tone ?? "Friendly",
      language: ko ? "ko" : "en",
      metrics: {
        periodLabel: ko ? "최근 30일" : "Last 30 days",
        visits: analytics.views30d,
        visitsGrowthPct: analytics.viewsGrowthPct,
        leads: insights.leads.new30d,
        leadsGrowthPct: insights.leads.growthPct,
        blogPublished,
        couponIssued: insights.coupon.issued,
        couponUsageRate: insights.coupon.usageRate,
        topReferrer: analytics.referrers[0]?.source ?? null,
      },
    });
  } catch (err) {
    const msg =
      err instanceof AIGenerationError
        ? err.message
        : ko
          ? "전략 생성 중 문제가 발생했습니다."
          : "Failed to generate strategy.";
    return { error: msg };
  }

  // 저장 (RLS 소유자)
  await supabase
    .from("marketing_strategies")
    .insert({ business_id: businessId, content: result });

  revalidatePath(`/business/${businessId}/strategy`);
  return { result };
}
