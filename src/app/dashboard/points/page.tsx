import { redirect } from "next/navigation";
import { getUser, getProfileName } from "@/lib/queries";
import { getMyTransactions, getMyPayments } from "@/lib/points";
import { getPointBreakdown } from "@/lib/payments/service";
import { getSubscriptionOverview, SERVICE_BY_KIND } from "@/lib/subscription";
import { getServicePrices } from "@/lib/payments/prices";
import { getSubscriptionRow } from "@/lib/payments/billing";
import { getPendingBankTransfer } from "@/lib/payments/bankTransfer";
import { isBillingConfigured } from "@/lib/payments/portone";
import { PointsView } from "@/components/points/PointsView";

export const metadata = { title: "포인트" };

export default async function PointsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [
    breakdown,
    transactions,
    payments,
    overview,
    subRow,
    pendingBankTransfer,
    profileName,
    servicePrices,
  ] = await Promise.all([
    getPointBreakdown(user.id),
    getMyTransactions(user.id),
    getMyPayments(user.id),
    getSubscriptionOverview(user.id),
    getSubscriptionRow(user.id),
    getPendingBankTransfer(user.id),
    getProfileName(),
    getServicePrices([
      SERVICE_BY_KIND.site,
      SERVICE_BY_KIND.blog_post,
      SERVICE_BY_KIND.card_news,
      SERVICE_BY_KIND.ai_image,
    ]),
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
        pendingBankTransfer: pendingBankTransfer
          ? {
              plan: pendingBankTransfer.plan,
              amount: pendingBankTransfer.amount,
              depositorName: pendingBankTransfer.depositorName,
            }
          : null,
      }}
      transactions={transactions}
      overage={{
        site: servicePrices[SERVICE_BY_KIND.site] ?? 0,
        blogPost: servicePrices[SERVICE_BY_KIND.blog_post] ?? 0,
        cardNews: servicePrices[SERVICE_BY_KIND.card_news] ?? 0,
        aiImage: servicePrices[SERVICE_BY_KIND.ai_image] ?? 0,
      }}
      payments={payments.map((p) => ({
        id: p.id,
        orderId: p.order_id,
        amount: p.amount,
        credits: p.credits + p.bonus_credits,
        status: p.status,
        created_at: p.created_at,
      }))}
      customerName={profileName}
      customerEmail={user.email ?? ""}
    />
  );
}
