import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getNetworkDashboard } from "@/lib/network";
import { MarketerView } from "@/components/marketer/MarketerView";
import { PLANS, getPlanById, type PlanId } from "@/lib/plans";
import { listProductsAdmin } from "@/lib/payments/orders";

export const metadata = { title: "마케터" };

export default async function MarketerPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const data = await getNetworkDashboard(user.id);
  if (!data) redirect("/dashboard");

  // 지급률 표에 쓸 상품명 매핑 (플랜은 PLANS에서 바로 라벨링)
  const products = await listProductsAdmin();
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const planIds = new Set(PLANS.map((p) => p.id));
  const rateLabel = (itemType: string, itemKey: string): string => {
    if (itemType === "subscription_plan")
      return planIds.has(itemKey as PlanId)
        ? `${getPlanById(itemKey as PlanId).name.ko} 구독`
        : itemKey;
    return productName.get(itemKey) ?? itemKey;
  };

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.storyup.me";

  return (
    <MarketerView
      siteUrl={siteUrl}
      code={data.code}
      role={data.member.role}
      status={data.member.status}
      split={data.member.split}
      upline={data.upline}
      rates={data.rates.map((r) => ({
        itemType: r.itemType,
        itemKey: r.itemKey,
        label: rateLabel(r.itemType, r.itemKey),
        ratePct: r.ratePct,
        active: r.active,
      }))}
      downline={data.downline}
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
        role: c.role_at_sale ?? "",
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
      }))}
    />
  );
}
