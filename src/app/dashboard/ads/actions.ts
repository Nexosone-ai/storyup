"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/queries";
import {
  acceptCampaign,
  setPlacementStatus,
  type AdSlot,
} from "@/lib/ads/placements";

type Result = { ok?: boolean; error?: string; message?: string };

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** 블로거가 캠페인을 수락해 자기 사이트에 집행. */
export async function acceptCampaignAction(
  businessId: string,
  campaignId: string,
  slots: AdSlot[],
): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "로그인이 필요합니다." };
  const biz = await getBusiness(businessId);
  if (!biz) return { error: "내 사업체가 아닙니다." };
  const res = await acceptCampaign({
    bloggerUserId: uid,
    businessId,
    campaignId,
    slots,
  });
  if (res.ok) revalidatePath("/dashboard/ads");
  return res.ok ? { ok: true, message: "광고를 수락했습니다." } : res;
}

export async function setPlacementStatusAction(
  placementId: string,
  status: "active" | "paused" | "ended",
): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "로그인이 필요합니다." };
  const res = await setPlacementStatus(placementId, uid, status);
  if (res.ok) revalidatePath("/dashboard/ads");
  return res;
}
