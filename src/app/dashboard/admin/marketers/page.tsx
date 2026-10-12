import { listProductsAdmin } from "@/lib/payments/orders";
import {
  listDistributorsAdmin,
  listAllDistributorRatesAdmin,
  listNetworkReferralsAdmin,
} from "@/lib/network";
import { listSettlementsAdmin } from "@/lib/marketers";
import { PLANS } from "@/lib/plans";
import {
  AdminDistributors,
  AdminDistributorRates,
  AdminNetworkReferrals,
  AdminSettlements,
} from "@/components/admin/AdminMarketersView";

export const metadata = { title: "관리자 · 유통 네트워크·정산" };

export default async function AdminMarketersPage() {
  const [products, distributors, rates, referrals, settlements] =
    await Promise.all([
      listProductsAdmin(),
      listDistributorsAdmin(),
      listAllDistributorRatesAdmin(),
      listNetworkReferralsAdmin(),
      listSettlementsAdmin(),
    ]);

  // 지급률 설정 대상: 유료 구독 플랜 + 판매중 상품
  const rateTargets = [
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
    <div className="mx-auto max-w-2xl space-y-10">
      <AdminDistributors distributors={distributors} />
      <AdminDistributorRates
        distributors={distributors}
        targets={rateTargets}
        rates={rates}
      />
      <AdminNetworkReferrals referrals={referrals} />
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
    </div>
  );
}
