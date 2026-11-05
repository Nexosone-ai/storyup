"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/points";
import { CHANNEL_ADS_ENABLED } from "@/lib/channelAds/config";
import { setChannelStatus } from "@/lib/channelAds/channels";
import {
  setShareEarningPaid,
  setShareOrderAdminStatus,
} from "@/lib/channelAds/settlement";

export async function setChannelStatusAction(
  id: string,
  status: "active" | "rejected" | "hidden" | "pending",
): Promise<{ error?: string }> {
  if (!CHANNEL_ADS_ENABLED) return { error: "이용할 수 없습니다." };
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const res = await setChannelStatus(id, status);
  if (!res.error) revalidatePath("/dashboard/admin/channel-ads");
  return res;
}

/** 관리자 — 정산 지급 완료 표시(상태만, 실제 송금 수동). */
export async function setShareEarningPaidAction(
  shareOrderId: string,
): Promise<{ ok?: true; error?: string }> {
  if (!CHANNEL_ADS_ENABLED) return { error: "이용할 수 없습니다." };
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const res = await setShareEarningPaid(shareOrderId);
  if (res.ok) revalidatePath("/dashboard/admin/channel-ads");
  return res;
}

/** 관리자 — 주문 환불/분쟁 상태 전환(상태·기록만, 실제 환불 수동). */
export async function setShareOrderAdminStatusAction(
  shareOrderId: string,
  status: "refunded" | "disputed",
): Promise<{ ok?: true; error?: string }> {
  if (!CHANNEL_ADS_ENABLED) return { error: "이용할 수 없습니다." };
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const res = await setShareOrderAdminStatus(shareOrderId, status);
  if (res.ok) revalidatePath("/dashboard/admin/channel-ads");
  return res;
}
