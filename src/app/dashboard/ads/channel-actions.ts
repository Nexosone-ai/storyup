"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/queries";
import { CHANNEL_ADS_ENABLED, type SharePlatform } from "@/lib/channelAds/config";
import {
  upsertChannel,
  setChannelHidden,
  type ChannelInput,
} from "@/lib/channelAds/channels";
import {
  createChannelShareOrder,
  type CreatedShareOrder,
  type ShareBuyer,
} from "@/lib/channelAds/orders";

async function requireUser(): Promise<string | null> {
  if (!CHANNEL_ADS_ENABLED) return null;
  const user = await getUser();
  return user?.id ?? null;
}

export async function saveChannelAction(
  input: ChannelInput,
): Promise<{ id?: string; error?: string }> {
  const uid = await requireUser();
  if (!uid) return { error: "권한이 없습니다." };
  if (!input.platform) return { error: "플랫폼을 선택해주세요." };
  if (!Number.isFinite(input.priceKrw) || input.priceKrw < 0)
    return { error: "단가를 올바르게 입력해주세요." };
  const res = await upsertChannel(uid, {
    ...input,
    platform: input.platform as SharePlatform,
  });
  if (res.id) revalidatePath("/dashboard/ads");
  return res;
}

export async function setChannelHiddenAction(
  id: string,
  hidden: boolean,
): Promise<{ error?: string }> {
  const uid = await requireUser();
  if (!uid) return { error: "권한이 없습니다." };
  const res = await setChannelHidden(uid, id, hidden);
  if (!res.error) revalidatePath("/dashboard/ads");
  return res;
}

export async function createChannelShareOrderAction(input: {
  channelId: string;
  contentType: "blog" | "card_news";
  contentRefId: string;
  message?: string | null;
  buyer: ShareBuyer;
}): Promise<{ order?: CreatedShareOrder; error?: string }> {
  const uid = await requireUser();
  if (!uid) return { error: "권한이 없습니다." };
  if (!input.channelId) return { error: "채널을 선택해주세요." };
  if (!input.contentRefId) return { error: "공유할 콘텐츠를 선택해주세요." };
  if (!input.buyer?.name?.trim() || !input.buyer?.email?.trim())
    return { error: "이름과 이메일을 입력해주세요." };
  return createChannelShareOrder({
    advertiserUserId: uid,
    channelId: input.channelId,
    contentType: input.contentType,
    contentRefId: input.contentRefId,
    message: input.message ?? null,
    buyer: input.buyer,
  });
}
