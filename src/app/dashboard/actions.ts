"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SimpleState {
  error?: string;
  message?: string;
}

export async function updateProfileAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "이름을 입력해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("profiles")
    .update({ name })
    .eq("user_id", user.id);
  if (error) return { error: "저장에 실패했습니다." };

  revalidatePath("/dashboard");
  return { message: "저장되었습니다." };
}
