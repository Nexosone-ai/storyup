"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** 로그인 사용자의 안 읽은 문의를 모두 읽음 처리한다 (RLS로 본인 것만). */
export async function markInquiriesReadAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("site_inquiries")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  revalidatePath("/dashboard/inquiries");
}

/** 문의 1건 삭제 (RLS로 본인 것만). */
export async function deleteInquiryAction(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("site_inquiries").delete().eq("id", id);
  revalidatePath("/dashboard/inquiries");
}
