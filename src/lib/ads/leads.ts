import { createAdminClient } from "@/lib/supabase/server";
import { splitClickCharge } from "./shares";
import { getPlatformFeePct } from "./settings";
import { spendFromWallet } from "./wallet";
import type { AdLeadRow } from "@/types/database";

/**
 * CPA 리드 제출 — 광고 경유 리드폼 1건당 과금. 중복(캠페인×전화)은 1회만.
 * 과금 성공 시에만 리드가 확정(charged)되고 광고주에게 전달·블로거 수익 적립.
 */
export async function submitAdLead(args: {
  placementId: string;
  name: string;
  phone: string;
  message?: string;
}): Promise<{ ok?: boolean; error?: string; message?: string }> {
  const name = args.name.trim().slice(0, 40);
  const phone = args.phone.replace(/[^0-9]/g, "");
  if (!name || phone.length < 10)
    return { error: "이름과 휴대폰 번호를 정확히 입력해주세요." };

  const admin = createAdminClient();
  const { data: placement } = await admin
    .from("ad_placements")
    .select("id,campaign_id,business_id,blogger_user_id,status")
    .eq("id", args.placementId)
    .maybeSingle();
  if (!placement || placement.status !== "active")
    return { error: "진행 중인 광고가 아닙니다." };

  const { data: campaign } = await admin
    .from("ad_campaigns")
    .select("id,type,business_id,bid_amount,total_budget,spent,status")
    .eq("id", placement.campaign_id)
    .maybeSingle();
  if (!campaign || campaign.type !== "cpa" || campaign.status !== "active")
    return { error: "진행 중인 리드 광고가 아닙니다." };

  // 리드 insert (campaign×phone 중복 차단)
  const { data: lead, error: insErr } = await admin
    .from("ad_leads")
    .insert({
      campaign_id: campaign.id,
      placement_id: placement.id,
      advertiser_business_id: campaign.business_id,
      blogger_user_id: placement.blogger_user_id,
      name,
      phone,
      message: (args.message ?? "").trim().slice(0, 500) || null,
      charged: false,
    })
    .select("id")
    .single();
  if (insErr?.code === "23505")
    return { ok: true, message: "이미 신청이 접수되었습니다." };
  if (insErr || !lead) return { error: "신청에 실패했습니다. 잠시 후 다시 시도해주세요." };

  // 예산 가드 + 과금
  if (campaign.spent >= campaign.total_budget) {
    await admin.from("ad_leads").delete().eq("id", lead.id);
    await admin
      .from("ad_campaigns")
      .update({ status: "exhausted", updated_at: new Date().toISOString() })
      .eq("id", campaign.id);
    return { error: "광고가 예산 소진으로 마감되었습니다." };
  }
  const fee = await getPlatformFeePct();
  const split = splitClickCharge(campaign.bid_amount, fee);
  const spend = await spendFromWallet({
    businessId: campaign.business_id,
    amount: split.advertiser,
    reason: "광고 리드(CPA) 과금",
    refType: "lead",
    refId: lead.id,
  });
  if (!spend.ok) {
    await admin.from("ad_leads").delete().eq("id", lead.id);
    if (spend.insufficient)
      await admin
        .from("ad_campaigns")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", campaign.id);
    return { error: "광고가 마감되었습니다." };
  }

  await admin
    .from("ad_leads")
    .update({ charged: true, amount: split.advertiser })
    .eq("id", lead.id);
  await admin.from("ad_earnings").insert({
    blogger_user_id: placement.blogger_user_id,
    business_id: placement.business_id,
    campaign_id: campaign.id,
    placement_id: placement.id,
    event_type: "action",
    ref_id: lead.id,
    amount: split.blogger,
    status: "pending",
  });
  const nextSpent = campaign.spent + split.advertiser;
  await admin
    .from("ad_campaigns")
    .update({
      spent: nextSpent,
      status: nextSpent >= campaign.total_budget ? "exhausted" : campaign.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);

  return { ok: true, message: "신청이 접수되었습니다. 곧 연락드리겠습니다." };
}

export interface LeadAd {
  placementId: string;
  campaignName: string;
  creative: {
    image?: string;
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    aspect?: "4:1" | "3:1" | "16:9" | "1:1";
  };
}

/** 리드폼 페이지용 — 유효한(활성 CPA) placement의 소재. 아니면 null. */
export async function getLeadAd(placementId: string): Promise<LeadAd | null> {
  const admin = createAdminClient();
  const { data: placement } = await admin
    .from("ad_placements")
    .select("id,campaign_id,status")
    .eq("id", placementId)
    .maybeSingle();
  if (!placement || placement.status !== "active") return null;
  const { data: campaign } = await admin
    .from("ad_campaigns")
    .select("name,type,status,creative")
    .eq("id", placement.campaign_id)
    .maybeSingle();
  if (!campaign || campaign.type !== "cpa" || campaign.status !== "active")
    return null;
  return {
    placementId,
    campaignName: campaign.name,
    creative: (campaign.creative ?? {}) as LeadAd["creative"],
  };
}

/** 광고주가 수령한 리드(DB) 목록. */
export async function listAdvertiserLeads(
  businessId: string,
): Promise<AdLeadRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ad_leads")
    .select("*")
    .eq("advertiser_business_id", businessId)
    .eq("charged", true)
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}

/** 캠페인별 리드 수(광고주 리포트용). */
export async function leadCountsByCampaign(
  campaignIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (campaignIds.length === 0) return map;
  const admin = createAdminClient();
  const { data } = await admin
    .from("ad_leads")
    .select("campaign_id")
    .in("campaign_id", campaignIds)
    .eq("charged", true);
  for (const r of data ?? [])
    map.set(r.campaign_id, (map.get(r.campaign_id) ?? 0) + 1);
  return map;
}
