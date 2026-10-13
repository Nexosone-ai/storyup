import { listCampaignsAdmin } from "@/lib/ads/campaigns";
import { getPlatformFeePct } from "@/lib/ads/settings";
import { listAdSettlementsAdmin } from "@/lib/ads/settlement";
import { AdminAdsView } from "@/components/admin/AdminAdsView";

export const metadata = { title: "관리자 · 광고" };

export default async function AdminAdsPage() {
  const [campaigns, feePct, settlements] = await Promise.all([
    listCampaignsAdmin(),
    getPlatformFeePct(),
    listAdSettlementsAdmin(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <AdminAdsView
        campaigns={campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          businessName: c.businessName,
          status: c.status,
          bidAmount: c.bid_amount,
          totalBudget: c.total_budget,
          spent: c.spent,
          balance: c.balance,
          targetUrl: c.target_url,
        }))}
        feePct={feePct}
        settlements={settlements.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          period: s.period,
          gross: s.gross,
          tax: s.tax,
          net: s.net,
          count: s.earning_count,
          status: s.status,
        }))}
      />
    </div>
  );
}
