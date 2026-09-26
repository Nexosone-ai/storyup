"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

export interface PushSubInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** 브라우저 푸시 구독 저장(멱등, endpoint 기준 upsert). */
export async function savePushSubscriptionAction(
  sub: PushSubInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!sub?.endpoint || !sub?.p256dh || !sub?.auth)
    return { error: "구독 정보가 올바르지 않습니다." };

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { error: "구독 저장에 실패했습니다." };
  return {};
}

/** 브라우저 푸시 구독 해제. */
export async function deletePushSubscriptionAction(
  endpoint: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !endpoint) return;
  const admin = createAdminClient();
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
}
