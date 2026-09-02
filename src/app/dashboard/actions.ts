"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";

export interface SimpleState {
  error?: string;
  message?: string;
}

export async function updateProfileAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const ko = (await getLocale()) === "ko";
  const name = String(formData.get("name") ?? "").trim();
  if (!name)
    return { error: ko ? "이름을 입력해주세요." : "Please enter your name." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { error } = await supabase
    .from("profiles")
    .update({ name })
    .eq("user_id", user.id);
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };

  revalidatePath("/dashboard");
  return { message: ko ? "저장되었습니다." : "Saved." };
}
