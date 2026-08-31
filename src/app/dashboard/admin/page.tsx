import { redirect } from "next/navigation";
import { getUser, getProfileName } from "@/lib/queries";
import { isCurrentUserAdmin, getPendingWithdrawals } from "@/lib/points";
import {
  getRecentPaymentsAdmin,
  getAllPackagesAdmin,
  getServicePricesAdmin,
} from "@/lib/payments/admin";
import { AdminView } from "@/components/admin/AdminView";
import {
  AdminPayments,
  AdminPointLookup,
  AdminPackages,
  AdminServicePrices,
} from "@/components/admin/AdminBillingView";

export const metadata = { title: "관리자" };

export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const admin = await isCurrentUserAdmin();
  if (!admin) redirect("/dashboard");

  await getProfileName(); // ensures profile exists
  const [pending, payments, packages, prices] = await Promise.all([
    getPendingWithdrawals(),
    getRecentPaymentsAdmin(),
    getAllPackagesAdmin(),
    getServicePricesAdmin(),
  ]);

  return (
    <div className="space-y-10">
      <AdminView pending={pending} />
      <div className="mx-auto max-w-2xl space-y-10">
        <AdminPointLookup />
        <AdminPackages
          packages={packages.map((p) => ({
            id: p.id,
            name: p.name,
            price_krw: p.price_krw,
            credits: p.credits,
            bonus_credits: p.bonus_credits,
            active: p.active,
            sort_order: p.sort_order,
          }))}
        />
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
