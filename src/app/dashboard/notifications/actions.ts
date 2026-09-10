"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** 로그인 사용자의 안 읽은 알림을 모두 읽음 처리한다 (RLS로 본인 것만). */
export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  revalidatePath("/dashboard/notifications");
}

/** 알림 1건 삭제 (RLS로 본인 것만). */
export async function deleteNotificationAction(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").delete().eq("id", id);
  revalidatePath("/dashboard/notifications");
}
