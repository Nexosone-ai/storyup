import { notFound } from "next/navigation";
import { getUser, getBusiness } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { Card } from "@/components/ui/Card";
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
  const { data: latest } = await supabase
    .from("marketing_strategies")
    .select("content, created_at")
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl">
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
