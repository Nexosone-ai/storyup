"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PUBLISH_CHANNELS, type PublishChannel } from "@/types/domain";

export interface PublishState {
  error?: string;
  ok?: boolean;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function isChannel(v: string): v is PublishChannel {
  return (PUBLISH_CHANNELS as readonly string[]).includes(v);
}

export async function setConnection(
  businessId: string,
  channel: string,
  connected: boolean,
  accountLabel: string,
): Promise<PublishState> {
  if (!isChannel(channel)) return { error: "잘못된 채널입니다." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase.from("blog_connections").upsert(
    {
      business_id: businessId,
      channel,
      connected,
      account_label: accountLabel.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,channel" },
  );
  if (error) return { error: "저장에 실패했습니다." };
  revalidatePath(`/business/${businessId}/publishing`);
  return { ok: true };
}

export async function createSchedule(
  businessId: string,
  blogPostId: string,
  channel: string,
  scheduledAt: string,
): Promise<PublishState> {
  if (!isChannel(channel)) return { error: "잘못된 채널입니다." };
  if (!blogPostId) return { error: "글을 선택해주세요." };
  const when = new Date(scheduledAt);
  if (isNaN(when.getTime())) return { error: "예약 시간을 선택해주세요." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase.from("publish_schedules").insert({
    business_id: businessId,
    blog_post_id: blogPostId,
    channel,
    scheduled_at: when.toISOString(),
  });
  if (error) return { error: "예약에 실패했습니다." };
  revalidatePath(`/business/${businessId}/publishing`);
  return { ok: true };
}

export async function deleteSchedule(
  businessId: string,
  id: string,
): Promise<PublishState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase
    .from("publish_schedules")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) return { error: "삭제에 실패했습니다." };
  revalidatePath(`/business/${businessId}/publishing`);
  return { ok: true };
}
