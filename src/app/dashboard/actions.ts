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

/** 로그인한 사용자가 자기 비밀번호를 변경한다. */
export async function changePasswordAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const ko = (await getLocale()) === "ko";
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8)
    return {
      error: ko
        ? "비밀번호는 8자 이상이어야 합니다."
        : "Password must be at least 8 characters.",
    };
  if (password !== confirm)
    return {
      error: ko
        ? "비밀번호가 일치하지 않습니다."
        : "Passwords do not match.",
    };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // 새 비밀번호가 기존과 같으면 Supabase가 거부한다.
    const same = /different from the old/i.test(error.message);
    return {
      error: same
        ? ko
          ? "기존 비밀번호와 다른 비밀번호를 입력해주세요."
          : "Please choose a password different from your current one."
        : ko
          ? "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요."
          : "Failed to change password. Please try again shortly.",
    };
  }

  return {
    message: ko ? "비밀번호가 변경되었습니다." : "Your password was changed.",
  };
}
