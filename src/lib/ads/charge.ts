import { createAdminClient } from "@/lib/supabase/server";
import { splitClickCharge } from "./shares";
import { getPlatformFeePct } from "./settings";
import { spendFromWallet } from "./wallet";

/**
 * CPC 클릭 과금(멱등·부정클릭 차단). 항상 이동할 URL을 돌려준다.
 * CPC만 클릭 과금. CPV/CPA 클릭은 무과금 리다이렉트(CPV는 노출 과금, CPA는 리드 과금).
 * 어뷰징: (placement, visitor, 일자) 1회만 과금 / 자기클릭 무과금 / 예산·잔액 소진 시 캠페인 정지.
 */
export async function chargeClick(
  placementId: string,
  visitorKey: string,
  userId: string | null,
): Promise<string> {
  const admin = createAdminClient();
  const { data: placement } = await admin
    .from("ad_placements")
    .select("id,campaign_id,business_id,blogger_user_id,status")
    .eq("id", placementId)
    .maybeSingle();
  if (!placement) return "/";

  const { data: campaign } = await admin
    .from("ad_campaigns")
    .select("id,type,business_id,target_url,bid_amount,total_budget,spent,status")
    .eq("id", placement.campaign_id)
    .maybeSingle();
  const target = campaign?.target_url || "/";
  if (!campaign || campaign.status !== "active" || placement.status !== "active")
    return target;

  // CPC만 클릭 과금. 그 외 유형은 과금 없이 이동.
  if (campaign.type !== "cpc") return target;

  if (userId && userId === placement.blogger_user_id) return target; // 자기클릭
  if (campaign.spent >= campaign.total_budget) {
    await admin
      .from("ad_campaigns")
      .update({ status: "exhausted", updated_at: new Date().toISOString() })
      .eq("id", campaign.id);
    return target;
  }

  const { data: click, error: insErr } = await admin
    .from("ad_clicks")
    .insert({
      placement_id: placement.id,
      campaign_id: campaign.id,
      advertiser_business_id: campaign.business_id,
      blogger_user_id: placement.blogger_user_id,
      visitor_key: visitorKey,
      charged: false,
    })
    .select("id")
    .single();
  if (insErr || !click) return target; // 중복(하루 1회) → 무과금

  const fee = await getPlatformFeePct();
  const split = splitClickCharge(campaign.bid_amount, fee);
  const spend = await spendFromWallet({
    businessId: campaign.business_id,
    amount: split.advertiser,
    reason: "광고 클릭 과금",
    refType: "click",
    refId: click.id,
  });
  if (!spend.ok) {
    if (spend.insufficient)
      await admin
        .from("ad_campaigns")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", campaign.id);
    return target;
  }

  await admin
    .from("ad_clicks")
    .update({
      charged: true,
      amount: split.advertiser,
      fee_amount: split.fee,
      blogger_amount: split.blogger,
    })
    .eq("id", click.id);
  await admin.from("ad_earnings").insert({
    blogger_user_id: placement.blogger_user_id,
    business_id: placement.business_id,
    campaign_id: campaign.id,
    placement_id: placement.id,
    event_type: "click",
    ref_id: click.id,
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
  return target;
}

/**
 * 노출 기록 + (CPV) 노출 과금. CPC/CPA는 기록만(CTR용, 무과금).
 * CPV 어뷰징: (placement, visitor, 일자) 1회만 과금 / 익명키 없으면 미과금 / 자기노출 무과금.
 */
export async function recordImpression(
  placementId: string,
  visitorKey: string | null,
  userId: string | null = null,
): Promise<void> {
  const admin = createAdminClient();
  const { data: placement } = await admin
    .from("ad_placements")
    .select("id,campaign_id,business_id,blogger_user_id,status")
    .eq("id", placementId)
    .maybeSingle();
  if (!placement || placement.status !== "active") return;

  const { data: campaign } = await admin
    .from("ad_campaigns")
    .select("id,type,business_id,bid_amount,total_budget,spent,status")
    .eq("id", placement.campaign_id)
    .maybeSingle();
  if (!campaign) return;

  const { data: imp, error: insErr } = await admin
    .from("ad_impressions")
    .insert({
      placement_id: placementId,
      campaign_id: campaign.id,
      visitor_key: visitorKey,
    })
    .select("id")
    .single();
  if (insErr || !imp) return; // 하루 중복 → 기록/과금 안 함

  // CPV 과금
  if (campaign.type !== "cpv" || campaign.status !== "active") return;
  if (!visitorKey) return; // 식별 불가 노출은 미과금
  if (userId && userId === placement.blogger_user_id) return; // 자기노출
  if (campaign.spent >= campaign.total_budget) {
    await admin
      .from("ad_campaigns")
      .update({ status: "exhausted", updated_at: new Date().toISOString() })
      .eq("id", campaign.id);
    return;
  }

  const fee = await getPlatformFeePct();
  const split = splitClickCharge(campaign.bid_amount, fee);
  const spend = await spendFromWallet({
    businessId: campaign.business_id,
    amount: split.advertiser,
    reason: "광고 노출 과금",
    refType: "view",
    refId: imp.id,
  });
  if (!spend.ok) {
    if (spend.insufficient)
      await admin
        .from("ad_campaigns")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", campaign.id);
    return;
  }
  await admin.from("ad_earnings").insert({
    blogger_user_id: placement.blogger_user_id,
    business_id: placement.business_id,
    campaign_id: campaign.id,
    placement_id: placement.id,
    event_type: "view",
    ref_id: imp.id,
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
}
