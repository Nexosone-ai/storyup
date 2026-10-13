import { createAdminClient } from "@/lib/supabase/server";
import type { AdCampaignRow, AdPlacementRow } from "@/types/database";
import { AD_SLOTS, type AdSlot } from "./slots";
import { getAdBalance } from "./wallet";

export { AD_SLOTS };
export type { AdSlot };

export interface InventoryCampaign {
  id: string;
  name: string;
  type: string; // cpc | cpv | cpa
  advertiserName: string;
  bidAmount: number;
  budgetLeft: number;
  industry: string | null;
  creative: AdCampaignRow["creative"];
  targetUrl: string;
  /** 이 블로거의 집행 상태(없으면 null) — requested/active/paused/ended/declined */
  placementStatus: string | null;
}

/** 광고주별 지갑 잔액 맵. */
async function balancesFor(businessIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (businessIds.length === 0) return map;
  const admin = createAdminClient();
  const { data } = await admin
    .from("ad_wallet_tx")
    .select("business_id,amount")
    .in("business_id", businessIds);
  for (const r of data ?? [])
    map.set(r.business_id, (map.get(r.business_id) ?? 0) + r.amount);
  return map;
}

/**
 * 오픈 인벤토리 — 수락 가능한 활성 캠페인.
 * 조건: status=active + 예산 잔여 + **광고주 지갑 충전액 ≥ 단가**(결제 완료 광고만 노출).
 */
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
  const withBudget = (campaigns ?? []).filter((c) => c.spent < c.total_budget);
  if (withBudget.length === 0) return [];

  const bizIds = [...new Set(withBudget.map((c) => c.business_id))];
  const [{ data: bizs }, { data: placements }, balances] = await Promise.all([
    admin.from("businesses").select("id,name").in("id", bizIds),
    admin
      .from("ad_placements")
      .select("campaign_id,status")
      .eq("blogger_user_id", bloggerUserId),
    balancesFor(bizIds),
  ]);
  const nameById = new Map((bizs ?? []).map((b) => [b.id, b.name]));
  const statusByCampaign = new Map(
    (placements ?? []).map((p) => [p.campaign_id, p.status]),
  );

  // 충전액(지갑) ≥ 단가인 캠페인만 — 결제하지 않은 광고는 노출/신청 불가.
  const funded = withBudget.filter(
    (c) => (balances.get(c.business_id) ?? 0) >= c.bid_amount,
  );
  return funded.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    advertiserName: nameById.get(c.business_id) ?? "",
    bidAmount: c.bid_amount,
    budgetLeft: c.total_budget - c.spent,
    industry: c.industry,
    creative: c.creative,
    targetUrl: c.target_url,
    placementStatus: statusByCampaign.get(c.id) ?? null,
  }));
}

/**
 * 블로거가 캠페인 집행을 **요청**(status=requested). 광고주 승인 후 노출.
 * 게이트: 발행된 StoryUp 사이트 보유 + 광고주 충전액 ≥ 단가.
 */
export async function acceptCampaign(args: {
  bloggerUserId: string;
  businessId: string; // 블로거 본인 사업체
  campaignId: string;
  slots: AdSlot[];
}): Promise<{ ok?: boolean; error?: string }> {
  const admin = createAdminClient();

  // StoryUp 블로거 게이트 — 발행된 사이트가 있어야 광고 집행 가능.
  const { data: site } = await admin
    .from("websites")
    .select("status")
    .eq("business_id", args.businessId)
    .maybeSingle();
  if (!site || site.status !== "published")
    return {
      error:
        "발행된 StoryUp 사이트가 있어야 광고를 집행할 수 있어요. 사이트를 먼저 게시해주세요.",
    };

  const { data: campaign } = await admin
    .from("ad_campaigns")
    .select("id,status,business_id,bid_amount")
    .eq("id", args.campaignId)
    .maybeSingle();
  if (!campaign || campaign.status !== "active")
    return { error: "집행 가능한 광고가 아닙니다." };

  // 결제(충전) 게이트.
  const balance = await getAdBalance(campaign.business_id);
  if (balance < campaign.bid_amount)
    return { error: "광고주의 광고비가 충전되지 않아 지금은 신청할 수 없어요." };

  const slots = args.slots.filter((s) => AD_SLOTS.includes(s));
  if (slots.length === 0) return { error: "노출 위치를 하나 이상 선택하세요." };

  const { error } = await admin.from("ad_placements").upsert(
    {
      campaign_id: args.campaignId,
      business_id: args.businessId,
      blogger_user_id: args.bloggerUserId,
      slots,
      status: "requested",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "campaign_id,business_id" },
  );
  return error ? { error: "요청에 실패했습니다." } : { ok: true };
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
  // 블로거는 승인된(active/paused) 집행만 중지/재개/종료. 요청(requested)은 광고주 승인 대기.
  const { data: pl } = await admin
    .from("ad_placements")
    .select("status")
    .eq("id", placementId)
    .eq("blogger_user_id", bloggerUserId)
    .maybeSingle();
  if (!pl) return { error: "집행을 찾을 수 없습니다." };
  if (status === "active" && pl.status !== "paused")
    return { error: "승인 후에만 재개할 수 있습니다." };
  const { error } = await admin
    .from("ad_placements")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", placementId)
    .eq("blogger_user_id", bloggerUserId);
  return error ? { error: "변경 실패" } : { ok: true };
}

// ---------------- 광고주: 집행 요청 승인 ----------------

export interface PlacementRequest {
  id: string;
  campaignId: string;
  campaignName: string;
  bloggerName: string;
  bloggerSlug: string | null;
  slots: string[];
  createdAt: string;
}

/** 광고주(advertiserBusinessId)의 캠페인에 들어온 집행 요청 목록. */
export async function listPlacementRequests(
  advertiserBusinessId: string,
): Promise<PlacementRequest[]> {
  const admin = createAdminClient();
  const { data: camps } = await admin
    .from("ad_campaigns")
    .select("id,name")
    .eq("business_id", advertiserBusinessId);
  const campIds = (camps ?? []).map((c) => c.id);
  if (campIds.length === 0) return [];
  const nameById = new Map((camps ?? []).map((c) => [c.id, c.name]));
  const { data: pls } = await admin
    .from("ad_placements")
    .select("*")
    .in("campaign_id", campIds)
    .eq("status", "requested")
    .order("created_at", { ascending: false });
  const list = pls ?? [];
  if (list.length === 0) return [];
  const bizIds = [...new Set(list.map((p) => p.business_id))];
  const { data: bizs } = await admin
    .from("businesses")
    .select("id,name,slug")
    .in("id", bizIds);
  const bizById = new Map((bizs ?? []).map((b) => [b.id, b]));
  return list.map((p) => ({
    id: p.id,
    campaignId: p.campaign_id,
    campaignName: nameById.get(p.campaign_id) ?? "",
    bloggerName: bizById.get(p.business_id)?.name ?? "",
    bloggerSlug: bizById.get(p.business_id)?.slug ?? null,
    slots: p.slots,
    createdAt: p.created_at,
  }));
}

/** 광고주가 집행 요청 승인(active) 또는 거절(declined). */
export async function setPlacementApproval(
  placementId: string,
  advertiserBusinessId: string,
  approve: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: pl } = await admin
    .from("ad_placements")
    .select("id,campaign_id,status")
    .eq("id", placementId)
    .maybeSingle();
  if (!pl) return { error: "요청을 찾을 수 없습니다." };
  const { data: camp } = await admin
    .from("ad_campaigns")
    .select("business_id")
    .eq("id", pl.campaign_id)
    .maybeSingle();
  if (!camp || camp.business_id !== advertiserBusinessId)
    return { error: "권한이 없습니다." };
  if (pl.status !== "requested")
    return { error: "이미 처리된 요청입니다." };
  const { error } = await admin
    .from("ad_placements")
    .update({
      status: approve ? "active" : "declined",
      updated_at: new Date().toISOString(),
    })
    .eq("id", placementId);
  return error ? { error: "처리에 실패했습니다." } : { ok: true };
}
