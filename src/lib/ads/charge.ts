import { createAdminClient } from "@/lib/supabase/server";
import { splitClickCharge } from "./shares";
import { getPlatformFeePct } from "./settings";
import { spendFromWallet } from "./wallet";

/**
 * CPC 클릭 과금(멱등·부정클릭 차단). 항상 이동할 URL을 돌려준다(과금 실패/중복이어도 리다이렉트).
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
    .select("id,business_id,target_url,bid_amount,total_budget,spent,status")
    .eq("id", placement.campaign_id)
    .maybeSingle();
  const target = campaign?.target_url || "/";
  if (
    !campaign ||
    campaign.status !== "active" ||
    placement.status !== "active"
  )
    return target;

  // 자기클릭(블로거 본인) 무과금
  if (userId && userId === placement.blogger_user_id) return target;

  // 예산 소진 가드
  if (campaign.spent >= campaign.total_budget) {
    await admin
      .from("ad_campaigns")
      .update({ status: "exhausted", updated_at: new Date().toISOString() })
      .eq("id", campaign.id);
    return target;
  }

  // 중복 차단 멱등 insert — 하루 1회만(unique acl_dedup)
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
  if (insErr || !click) return target; // 23505 중복 → 무과금 리다이렉트

  // 광고주 지갑 차감(원자적)
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
    // 잔액 부족 → 캠페인 일시중지(미과금 클릭은 charged=false로 남음)
    if (spend.insufficient)
      await admin
        .from("ad_campaigns")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", campaign.id);
    return target;
  }

  // 과금 확정 + 블로거 수익 적립 + 캠페인 지출 갱신
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

/** 노출 기록(CTR용, CPC에선 과금 없음). 하루 1회 dedup. */
export async function recordImpression(
  placementId: string,
  visitorKey: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const { data: placement } = await admin
    .from("ad_placements")
    .select("campaign_id,status")
    .eq("id", placementId)
    .maybeSingle();
  if (!placement || placement.status !== "active") return;
  const { error } = await admin.from("ad_impressions").insert({
    placement_id: placementId,
    campaign_id: placement.campaign_id,
    visitor_key: visitorKey,
  });
  if (error && error.code !== "23505")
    console.error("[ads] impression failed", placementId, error);
}
