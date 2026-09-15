import { redirect } from "next/navigation";
import { getUser, getProfileName } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import {
  getRecentPaymentsAdmin,
  getServicePricesAdmin,
} from "@/lib/payments/admin";
import {
  listProductsAdmin,
  listProductOrdersAdmin,
} from "@/lib/payments/orders";
import {
  listMarketersAdmin,
  getMarketerRewardsAdmin,
  listSettlementsAdmin,
} from "@/lib/marketers";
import { PLANS } from "@/lib/plans";
import {
  getGrowthStatsAdmin,
  getGrowthSettingsAdmin,
} from "@/lib/gamification/admin";
import { getMembersAdmin } from "@/lib/admin/members";
import { AdminView } from "@/components/admin/AdminView";
import { AdminMembers } from "@/components/admin/AdminMembersView";
import { AdminGrowthView } from "@/components/admin/AdminGrowthView";
import {
  AdminPayments,
  AdminPointLookup,
  AdminServicePrices,
} from "@/components/admin/AdminBillingView";
import {
  AdminProducts,
  AdminProductOrders,
} from "@/components/admin/AdminProductsView";
import {
  AdminMarketers,
  AdminMarketerRewards,
  AdminSettlements,
} from "@/components/admin/AdminMarketersView";

export const metadata = { title: "관리자" };

export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const admin = await isCurrentUserAdmin();
  if (!admin) redirect("/dashboard");

  await getProfileName(); // ensures profile exists
  const [
    payments,
    prices,
    growthStats,
    growthSettings,
    members,
    products,
    productOrders,
  ] = await Promise.all([
    getRecentPaymentsAdmin(),
    getServicePricesAdmin(),
    getGrowthStatsAdmin(),
    getGrowthSettingsAdmin(),
    getMembersAdmin(),
    listProductsAdmin(),
    listProductOrdersAdmin(),
  ]);

  const [marketers, marketerRewards, settlements] = await Promise.all([
    listMarketersAdmin(),
    getMarketerRewardsAdmin(),
    listSettlementsAdmin(),
  ]);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.storyup.me";

  // 수당 정책 설정 대상: 유료 구독 플랜 + 판매중 상품
  const rewardTargets = [
    ...PLANS.filter((p) => p.priceKrw && p.priceKrw > 0).map((p) => ({
      itemType: "subscription_plan" as const,
      itemKey: p.id,
      label: `${p.name.ko} 구독`,
      price: p.priceKrw,
    })),
    ...products.map((p) => ({
      itemType: "product" as const,
      itemKey: p.id,
      label: p.name,
      price: p.price,
    })),
  ];

  return (
    <div className="space-y-10">
      <AdminView />
      <div className="mx-auto max-w-2xl space-y-10">
        <AdminMembers members={members.members} total={members.total} />
        <AdminGrowthView stats={growthStats} settings={growthSettings} />
        <AdminProducts
          siteUrl={siteUrl}
          products={products.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            description: p.description ?? "",
            price: p.price,
            imageUrl: p.image_url ?? "",
            active: p.active,
            sortOrder: p.sort_order,
            grantsPlan: p.grants_plan ?? "",
            grantDays: p.grant_days,
          }))}
        />
        <AdminProductOrders
          orders={productOrders.map((o) => ({
            id: o.id,
            created_at: o.created_at,
            productName: o.product_name,
            buyerName: o.buyer_name ?? "",
            buyerContact: [o.buyer_phone, o.buyer_email]
              .filter(Boolean)
              .join(" · "),
            amount: o.amount,
            method: o.payment_method ?? "",
            status: o.status,
          }))}
        />
        <AdminMarketers marketers={marketers} />
        <AdminMarketerRewards
          targets={rewardTargets}
          rewards={marketerRewards.map((r) => ({
            itemType: r.item_type as "subscription_plan" | "product",
            itemKey: r.item_key,
            rank: r.rank,
            amount: r.reward_amount,
            active: r.active,
          }))}
        />
        <AdminSettlements
          settlements={settlements.map((s) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            period: s.period,
            gross: s.gross,
            tax: s.tax,
            net: s.net,
            count: s.commission_count,
            status: s.status,
            payoutType: s.payout_type,
          }))}
        />
        <AdminPointLookup />
        <AdminServicePrices
          prices={prices.map((s) => ({
            service: s.service,
            label: s.label,
            price: s.price,
            active: s.active,
          }))}
        />
        <AdminPayments
          payments={payments.map((p) => ({
            id: p.id,
            created_at: p.created_at,
            userName: p.userName,
            userEmail: p.userEmail,
            orderId: p.order_id,
            provider: p.provider,
            method: p.payment_method ?? "",
            amount: p.amount,
            credits: p.credits + p.bonus_credits,
            status: p.status,
            transactionId: p.transaction_id ?? "",
          }))}
        />
      </div>
    </div>
  );
}
