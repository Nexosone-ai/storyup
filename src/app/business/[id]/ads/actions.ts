"use server";

import { revalidatePath } from "next/cache";
import { getBusiness } from "@/lib/queries";
import { createAdDeposit, syncAdDeposit } from "@/lib/ads/deposit";
import {
  createCampaign,
  setCampaignStatusByOwner,
  getCampaign,
  type CampaignInput,
} from "@/lib/ads/campaigns";
import { setPlacementApproval } from "@/lib/ads/placements";
import type { CreatedAdDeposit } from "@/lib/ads/deposit";

async function requireOwner(businessId: string) {
  const biz = await getBusiness(businessId);
  return !!biz;
}

/** 광고 지갑 충전 주문 생성(카드 결제창 직전). */
export async function createAdDepositAction(
  businessId: string,
  amount: number,
): Promise<{ order?: CreatedAdDeposit; error?: string }> {
  if (!(await requireOwner(businessId))) return { error: "권한이 없습니다." };
  return createAdDeposit(businessId, amount);
}

/** 결제창 종료 후 충전 확정(멱등). */
export async function confirmAdDepositAction(
  businessId: string,
  orderId: string,
): Promise<{ status: string; error?: string }> {
  if (!orderId.startsWith("adw_"))
    return { status: "FAILED", error: "주문 정보가 올바르지 않습니다." };
  const res = await syncAdDeposit(orderId);
  revalidatePath(`/business/${businessId}/ads`);
  return res;
}

export async function createCampaignAction(
  businessId: string,
  input: CampaignInput,
): Promise<{ id?: string; error?: string }> {
  if (!(await requireOwner(businessId))) return { error: "권한이 없습니다." };
  const res = await createCampaign(businessId, input);
  if (res.id) revalidatePath(`/business/${businessId}/ads`);
  return res;
}

export async function setCampaignStatusAction(
  businessId: string,
  campaignId: string,
  status: "active" | "paused" | "ended",
): Promise<{ ok?: boolean; error?: string }> {
  if (!(await requireOwner(businessId))) return { error: "권한이 없습니다." };
  const c = await getCampaign(campaignId);
  if (!c || c.business_id !== businessId)
    return { error: "캠페인을 찾을 수 없습니다." };
  const res = await setCampaignStatusByOwner(campaignId, status);
  if (res.ok) revalidatePath(`/business/${businessId}/ads`);
  return res;
}

/** 블로거 집행 요청 승인/거절. */
export async function approvePlacementAction(
  businessId: string,
  placementId: string,
  approve: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  if (!(await requireOwner(businessId))) return { error: "권한이 없습니다." };
  const res = await setPlacementApproval(placementId, businessId, approve);
  if (res.ok) revalidatePath(`/business/${businessId}/ads`);
  return res;
}
