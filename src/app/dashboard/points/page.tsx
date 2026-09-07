import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getMyTransactions, getMyPayments } from "@/lib/points";
import { getPointBreakdown } from "@/lib/payments/service";
import { getSubscriptionOverview } from "@/lib/subscription";
import { getSubscriptionRow } from "@/lib/payments/billing";
import { isBillingConfigured } from "@/lib/payments/portone";
import { PointsView } from "@/components/points/PointsView";

export const metadata = { title: "포인트" };

export default async function PointsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [breakdown, transactions, payments, overview, subRow] =
    await Promise.all([
      getPointBreakdown(user.id),
      getMyTransactions(user.id),
      getMyPayments(user.id),
      getSubscriptionOverview(user.id),
      getSubscriptionRow(user.id),
    ]);

  return (
    <PointsView
      userId={user.id}
      balance={breakdown.balance}
      subscription={{
        planId: overview.planId,
        usage: overview.usage,
        sites: overview.sites,
      }}
      billing={{
        configured: isBillingConfigured(),
        status: subRow?.status ?? null,
        periodEnd: subRow?.current_period_end ?? null,
        // 0017 이전 DB에서는 컬럼이 없어 undefined — 안전 기본값으로
        cancelAtPeriodEnd: !!subRow?.cancel_at_period_end,
        hasBillingKey: !!subRow?.billing_key,
      }}
      transactions={transactions}
      payments={payments.map((p) => ({
        id: p.id,
        orderId: p.order_id,
        amount: p.amount,
        credits: p.credits + p.bonus_credits,
        status: p.status,
        created_at: p.created_at,
      }))}
    />
  );
}
