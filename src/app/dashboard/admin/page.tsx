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

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.storyup.me";

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
