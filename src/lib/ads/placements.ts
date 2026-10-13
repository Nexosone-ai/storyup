import { createAdminClient } from "@/lib/supabase/server";
import type { AdCampaignRow, AdPlacementRow } from "@/types/database";
import { AD_SLOTS, type AdSlot } from "./slots";

export { AD_SLOTS };
export type { AdSlot };

export interface InventoryCampaign {
  id: string;
  name: string;
  advertiserName: string;
  bidAmount: number;
  budgetLeft: number;
  industry: string | null;
  creative: AdCampaignRow["creative"];
  targetUrl: string;
  alreadyAccepted: boolean;
}

/** 오픈 인벤토리 — 수락 가능한 활성 캠페인 목록(예산 잔여). bloggerUserId의 이미 수락 여부 표시. */
export async function listInventory(
  bloggerUserId: string,
): Promise<InventoryCampaign[]> {
  const admin = createAdminClient();
  const { data: campaigns } = await admin
    .from("ad_campaigns")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(200);
  const list = (campaigns ?? []).filter((c) => c.spent < c.total_budget);
  if (list.length === 0) return [];
  const bizIds = [...new Set(list.map((c) => c.business_id))];
  const [{ data: bizs }, { data: accepted }] = await Promise.all([
    admin.from("businesses").select("id,name").in("id", bizIds),
    admin
      .from("ad_placements")
      .select("campaign_id")
      .eq("blogger_user_id", bloggerUserId),
  ]);
  const nameById = new Map((bizs ?? []).map((b) => [b.id, b.name]));
  const acceptedSet = new Set((accepted ?? []).map((p) => p.campaign_id));
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    advertiserName: nameById.get(c.business_id) ?? "",
    bidAmount: c.bid_amount,
    budgetLeft: c.total_budget - c.spent,
    industry: c.industry,
    creative: c.creative,
    targetUrl: c.target_url,
    alreadyAccepted: acceptedSet.has(c.id),
  }));
}

/** 블로거가 캠페인 수락 → 자기 사이트에 집행(active). */
export async function acceptCampaign(args: {
  bloggerUserId: string;
  businessId: string; // 블로거 본인 사업체
  campaignId: string;
  slots: AdSlot[];
}): Promise<{ ok?: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from("ad_campaigns")
    .select("id,status")
    .eq("id", args.campaignId)
    .maybeSingle();
  if (!campaign || campaign.status !== "active")
    return { error: "집행 가능한 광고가 아닙니다." };
  const slots = args.slots.filter((s) => AD_SLOTS.includes(s));
  if (slots.length === 0) return { error: "노출 위치를 하나 이상 선택하세요." };
  const { error } = await admin.from("ad_placements").upsert(
    {
      campaign_id: args.campaignId,
      business_id: args.businessId,
      blogger_user_id: args.bloggerUserId,
      slots,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "campaign_id,business_id" },
  );
  return error ? { error: "수락에 실패했습니다." } : { ok: true };
}

export interface BloggerPlacement extends AdPlacementRow {
  campaignName: string;
  bidAmount: number;
  campaignStatus: string;
}

export async function listBloggerPlacements(
  bloggerUserId: string,
): Promise<BloggerPlacement[]> {
  const admin = createAdminClient();
  const { data: placements } = await admin
    .from("ad_placements")
    .select("*")
    .eq("blogger_user_id", bloggerUserId)
    .order("created_at", { ascending: false });
  const list = placements ?? [];
  if (list.length === 0) return [];
  const campIds = [...new Set(list.map((p) => p.campaign_id))];
  const { data: camps } = await admin
    .from("ad_campaigns")
    .select("id,name,bid_amount,status")
    .in("id", campIds);
  const byId = new Map((camps ?? []).map((c) => [c.id, c]));
  return list.map((p) => ({
    ...p,
    campaignName: byId.get(p.campaign_id)?.name ?? "",
    bidAmount: byId.get(p.campaign_id)?.bid_amount ?? 0,
    campaignStatus: byId.get(p.campaign_id)?.status ?? "",
  }));
}

export async function setPlacementStatus(
  placementId: string,
  bloggerUserId: string,
  status: "active" | "paused" | "ended",
): Promise<{ ok?: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ad_placements")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", placementId)
    .eq("blogger_user_id", bloggerUserId);
  return error ? { error: "변경 실패" } : { ok: true };
}
