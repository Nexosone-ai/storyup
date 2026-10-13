import { createAdminClient } from "@/lib/supabase/server";
import { getAdBalance } from "./wallet";
import { listCampaigns } from "./campaigns";
import { leadCountsByCampaign } from "./leads";

export interface CampaignStat {
  campaignId: string;
  name: string;
  type: string; // cpc | cpv | cpa
  status: string;
  bidAmount: number;
  totalBudget: number;
  spent: number;
  impressions: number;
  clicks: number; // 과금된 클릭
  leads: number; // 과금된 리드(CPA)
  ctr: number; // %
}

export interface AdvertiserReport {
  balance: number;
  campaigns: CampaignStat[];
  totalSpent: number;
  totalClicks: number;
  totalImpressions: number;
}

/** 광고주 상세 리포트 — 캠페인별 노출·클릭·CTR·지출 + 지갑 잔액. */
export async function getAdvertiserReport(
  businessId: string,
): Promise<AdvertiserReport> {
  const admin = createAdminClient();
  const campaigns = await listCampaigns(businessId);
  const ids = campaigns.map((c) => c.id);
  const clicksByCamp = new Map<string, number>();
  const impByCamp = new Map<string, number>();
  let leadsByCamp = new Map<string, number>();
  if (ids.length > 0) {
    const [{ data: clicks }, { data: imps }, leads] = await Promise.all([
      admin
        .from("ad_clicks")
        .select("campaign_id,charged")
        .in("campaign_id", ids)
        .eq("charged", true),
      admin.from("ad_impressions").select("campaign_id").in("campaign_id", ids),
      leadCountsByCampaign(ids),
    ]);
    for (const c of clicks ?? [])
      clicksByCamp.set(c.campaign_id, (clicksByCamp.get(c.campaign_id) ?? 0) + 1);
    for (const i of imps ?? [])
      impByCamp.set(i.campaign_id, (impByCamp.get(i.campaign_id) ?? 0) + 1);
    leadsByCamp = leads;
  }
  const stats: CampaignStat[] = campaigns.map((c) => {
    const clicks = clicksByCamp.get(c.id) ?? 0;
    const impressions = impByCamp.get(c.id) ?? 0;
    return {
      campaignId: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      bidAmount: c.bid_amount,
      totalBudget: c.total_budget,
      spent: c.spent,
      impressions,
      clicks,
      leads: leadsByCamp.get(c.id) ?? 0,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0,
    };
  });
  return {
    balance: await getAdBalance(businessId),
    campaigns: stats,
    totalSpent: stats.reduce((s, c) => s + c.spent, 0),
    totalClicks: stats.reduce((s, c) => s + c.clicks, 0),
    totalImpressions: stats.reduce((s, c) => s + c.impressions, 0),
  };
}

export interface BloggerEarningsReport {
  total: number;
  pending: number;
  paid: number;
  recent: {
    id: string;
    campaignId: string | null;
    amount: number;
    status: string;
    occurredAt: string;
  }[];
}

export async function getBloggerEarningsReport(
  bloggerUserId: string,
): Promise<BloggerEarningsReport> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ad_earnings")
    .select("id,campaign_id,amount,status,occurred_at")
    .eq("blogger_user_id", bloggerUserId)
    .neq("status", "void")
    .order("occurred_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const sum = (f: (s: string) => boolean) =>
    rows.filter((r) => f(r.status)).reduce((s, r) => s + r.amount, 0);
  return {
    total: rows.reduce((s, r) => s + r.amount, 0),
    pending: sum((s) => s === "pending" || s === "settled"),
    paid: sum((s) => s === "paid"),
    recent: rows.slice(0, 40).map((r) => ({
      id: r.id,
      campaignId: r.campaign_id,
      amount: r.amount,
      status: r.status,
      occurredAt: r.occurred_at,
    })),
  };
}
