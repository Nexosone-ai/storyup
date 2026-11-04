"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/points";
import { CHANNEL_ADS_ENABLED } from "@/lib/channelAds/config";
import { setChannelStatus } from "@/lib/channelAds/channels";

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
