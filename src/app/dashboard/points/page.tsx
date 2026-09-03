import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import {
  getMyTransactions,
  getActivePackages,
  getMyPayments,
} from "@/lib/points";
import { getPointBreakdown } from "@/lib/payments/service";
import { getSubscriptionOverview } from "@/lib/subscription";
import { PointsView } from "@/components/points/PointsView";

export const metadata = { title: "포인트" };

export default async function PointsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [breakdown, transactions, packages, payments, overview] =
    await Promise.all([
      getPointBreakdown(user.id),
      getMyTransactions(user.id),
      getActivePackages(),
      getMyPayments(user.id),
      getSubscriptionOverview(user.id),
    ]);

  return (
    <PointsView
      balance={breakdown.balance}
      subscription={{
        planId: overview.planId,
        usage: overview.usage,
        sites: overview.sites,
      }}
      transactions={transactions}
      packages={packages.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price_krw,
        credits: p.credits,
        bonus: p.bonus_credits,
      }))}
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
