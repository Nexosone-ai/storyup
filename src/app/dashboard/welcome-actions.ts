"use server";

import { createClient } from "@/lib/supabase/server";

/** 환영 가이드 확인 처리 — profiles.onboarded_at 를 지금으로 기록(멱등). */
export async function markWelcomeSeenAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("onboarded_at", null);
}
