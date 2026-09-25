"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runIntegrityReport } from "@/lib/admin/integrity";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data?.is_admin;
}

/** 관리자 온디맨드 정합성 점검. */
export async function runIntegrityNowAction(): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: "권한이 없습니다." };
  try {
    await runIntegrityReport("manual");
    revalidatePath("/dashboard/admin/integrity");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "점검에 실패했습니다." };
  }
}
