import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser } from "@/lib/queries";
import { getPlanId } from "@/lib/subscription";
import { getSubscriptionRow } from "@/lib/payments/billing";
import { isBillingConfigured } from "@/lib/payments/portone";
import { PlansView } from "@/components/plans/PlansView";

export const metadata: Metadata = { title: "구독 플랜" };

export default async function PlansPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [planId, subRow] = await Promise.all([
    getPlanId(user.id),
    getSubscriptionRow(user.id),
  ]);

  return (
    <PlansView
      userId={user.id}
      currentPlanId={planId}
      billing={{
        configured: isBillingConfigured(),
        status: subRow?.status ?? null,
        periodEnd: subRow?.current_period_end ?? null,
        // 0017 이전 DB에서는 컬럼이 없어 undefined — 안전 기본값으로
        cancelAtPeriodEnd: !!subRow?.cancel_at_period_end,
        hasBillingKey: !!subRow?.billing_key,
      }}
    />
  );
}
