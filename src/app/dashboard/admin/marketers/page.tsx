import { listProductsAdmin } from "@/lib/payments/orders";
import {
  listMarketersAdmin,
  getMarketerRewardsAdmin,
  listSettlementsAdmin,
} from "@/lib/marketers";
import { PLANS } from "@/lib/plans";
import {
  AdminMarketers,
  AdminMarketerRewards,
  AdminSettlements,
} from "@/components/admin/AdminMarketersView";

export const metadata = { title: "관리자 · 마케터·정산" };

export default async function AdminMarketersPage() {
  const [products, marketers, marketerRewards, settlements] = await Promise.all(
    [
      listProductsAdmin(),
      listMarketersAdmin(),
      getMarketerRewardsAdmin(),
      listSettlementsAdmin(),
    ],
  );

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
    <div className="mx-auto max-w-2xl space-y-10">
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
    </div>
  );
}
