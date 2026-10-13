import { createAdminClient } from "@/lib/supabase/server";
import type { AdSlot } from "./placements";
import type { CampaignCreative } from "./campaigns";

export interface ServedAd {
  placementId: string;
  campaignId: string;
  type: "cpc" | "cpv" | "cpa";
  creative: CampaignCreative;
}

/**
 * 블로거 사이트(businessId)의 특정 슬롯에 노출할 광고 1개를 고른다.
 * active placement × active 캠페인(예산 잔여) 중 무작위 1개. 없으면 null.
 * 공개 페이지(서버)에서 호출 — 읽기 전용(admin client).
 */
export async function getActiveAdFor(
  businessId: string,
  slot: AdSlot,
): Promise<ServedAd | null> {
  const admin = createAdminClient();
  const { data: placements } = await admin
    .from("ad_placements")
    .select("id,campaign_id,slots,status")
    .eq("business_id", businessId)
    .eq("status", "active")
    .contains("slots", [slot]);
  const list = placements ?? [];
  if (list.length === 0) return null;

  const campIds = [...new Set(list.map((p) => p.campaign_id))];
  const { data: camps } = await admin
    .from("ad_campaigns")
    .select("id,status,spent,total_budget,creative,type,business_id,bid_amount")
    .in("id", campIds)
    .eq("status", "active");
  const active = (camps ?? []).filter((c) => c.spent < c.total_budget);
  // 결제(충전) 게이트 — 광고주 지갑 잔액 ≥ 단가인 캠페인만 노출.
  const advIds = [...new Set(active.map((c) => c.business_id))];
  const balById = new Map<string, number>();
  if (advIds.length > 0) {
    const { data: wt } = await admin
      .from("ad_wallet_tx")
      .select("business_id,amount")
      .in("business_id", advIds);
    for (const r of wt ?? [])
      balById.set(r.business_id, (balById.get(r.business_id) ?? 0) + r.amount);
  }
  const validCampaigns = new Map(
    active
      .filter((c) => (balById.get(c.business_id) ?? 0) >= c.bid_amount)
      .map((c) => [c.id, c]),
  );
  const candidates = list.filter((p) => validCampaigns.has(p.campaign_id));
  if (candidates.length === 0) return null;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const camp = validCampaigns.get(pick.campaign_id)!;
  return {
    placementId: pick.id,
    campaignId: pick.campaign_id,
    type: (camp.type ?? "cpc") as "cpc" | "cpv" | "cpa",
    creative: (camp.creative ?? {}) as CampaignCreative,
  };
}
