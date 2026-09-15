import {
  getRecentPaymentsAdmin,
  getServicePricesAdmin,
} from "@/lib/payments/admin";
import {
  AdminPayments,
  AdminPointLookup,
  AdminServicePrices,
} from "@/components/admin/AdminBillingView";

export const metadata = { title: "관리자 · 결제·가격" };

export default async function AdminBillingPage() {
  const [payments, prices] = await Promise.all([
    getRecentPaymentsAdmin(),
    getServicePricesAdmin(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-10">
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
  );
}
