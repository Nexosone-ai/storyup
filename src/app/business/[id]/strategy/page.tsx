import { notFound } from "next/navigation";
import { getUser, getBusiness } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { getAnalytics, getCustomerInsights } from "@/lib/analytics";
import { buildMarketingSuggestions } from "@/lib/suggestions";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/Button";
import { StrategyView } from "@/components/marketing/StrategyView";
import type { MarketingStrategyResult } from "@/types/domain";

export const metadata = { title: "AI 마케팅 전략" };

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ko = (await getLocale()) === "ko";
  const business = await getBusiness(id);
  if (!business) notFound();

  const user = await getUser();
  const planId = user ? await getPlanId(user.id) : "free";
  const plan = getPlanById(planId);
  const unlimited = planId === "pro" || planId === "partner";

  if (!plan.aiStrategy) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "AI 마케팅 전략" : "AI marketing strategy"}
        </h1>
        <Card className="flex flex-col items-start gap-3 p-8">
          <p className="text-lg font-semibold">
            {ko
              ? "AI 마케팅 전략은 Basic 이상 플랜에서 제공돼요."
              : "Available on Basic and higher."}
          </p>
          <p className="text-sm text-muted">
            {ko
              ? "방문·리드·발행 지표를 AI가 분석해 이번 기간에 할 마케팅 액션을 제안해요."
              : "AI reads your visits, leads, and publishing to suggest concrete actions."}
          </p>
          <ButtonLink href="/dashboard/plans">
            {ko ? "플랜 업그레이드" : "Upgrade plan"}
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: latest }, adata, insights] = await Promise.all([
    supabase
      .from("marketing_strategies")
      .select("content, created_at")
      .eq("business_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getAnalytics(id),
    getCustomerInsights(id),
  ]);
  // 규칙 기반 맞춤 제안 — 애널리틱스에서 이곳(AI 전략)으로 이동.
  const suggestions = buildMarketingSuggestions(adata, insights, ko);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {suggestions.length > 0 && (
        <Card className="border-primary/25 bg-primary-soft/30">
          <h2 className="mb-3 flex items-center gap-2 font-semibold tracking-tight">
            <Icon.sparkles width={18} height={18} className="text-primary" />
            {ko ? "맞춤 제안" : "Suggestions for you"}
          </h2>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-foreground/90">{s}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <StrategyView
        businessId={id}
        ko={ko}
        unlimited={unlimited}
        initial={
          latest
            ? {
                content: latest.content as MarketingStrategyResult,
                createdAt: latest.created_at,
              }
            : null
        }
      />
    </div>
  );
}
