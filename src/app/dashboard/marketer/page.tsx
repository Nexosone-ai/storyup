import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { isCurrentUserMarketer, getMarketerDashboard } from "@/lib/marketers";
import { MarketerView } from "@/components/marketer/MarketerView";

export const metadata = { title: "마케터" };

export default async function MarketerPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const isMarketer = await isCurrentUserMarketer();
  if (!isMarketer) redirect("/dashboard");

  const data = await getMarketerDashboard(user.id);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.storyup.me";

  return (
    <MarketerView
      siteUrl={siteUrl}
      code={data.code}
      standing={data.standing}
      clients={data.clients}
      monthRevenue={data.monthRevenue}
      monthCommission={data.monthCommission}
      totalCommission={data.totalCommission}
      paidCommission={data.paidCommission}
      recent={data.recent.map((c) => ({
        id: c.id,
        occurredAt: c.occurred_at,
        sourceType: c.source_type,
        itemLabel: c.item_label ?? c.item_key,
        rank: c.rank_at_sale,
        gross: c.gross_sale,
        amount: c.amount,
        status: c.status,
      }))}
      settlements={data.settlements.map((s) => ({
        id: s.id,
        period: s.period,
        gross: s.gross,
        tax: s.tax,
        net: s.net,
        count: s.commission_count,
        status: s.status,
        payoutType: s.payout_type,
      }))}
    />
  );
}
