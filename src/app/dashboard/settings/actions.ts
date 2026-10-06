"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { deleteAccount } from "@/lib/account/deletion";
import type { SimpleState } from "@/app/dashboard/actions";

/** 로그인한 사용자가 자기 계정을 삭제한다(회원탈퇴). 성공 시 /goodbye로 이동. */
export async function deleteAccountAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const ko = (await getLocale()) === "ko";
  const confirmEmail = String(formData.get("confirmEmail") ?? "")
    .trim()
    .toLowerCase();
  const reason = String(formData.get("reason") ?? "")
    .trim()
    .slice(0, 500);

  // 실수 방지: 탈퇴 사유를 반드시 받는다.
  if (!reason)
    return {
      error: ko ? "탈퇴 사유를 입력해주세요." : "Please tell us why you are leaving.",
    };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // 실수 방지: 본인 이메일을 그대로 다시 입력해야 삭제한다(서버가 최종 검증).
  const accountEmail = (user.email ?? "").trim().toLowerCase();
  if (!confirmEmail || confirmEmail !== accountEmail)
    return {
      error: ko
        ? "본인 이메일을 정확히 입력해주세요."
        : "Enter your own email address exactly to confirm.",
    };

  const res = await deleteAccount(user.id, { reason, ko });
  if ("error" in res) return { error: res.error };

  // 사용자는 이미 서버에서 지워졌으므로 로컬 세션(쿠키)만 정리한다.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* 미들웨어가 다음 요청에서 세션 없음을 처리한다 */
  }
  redirect("/goodbye");
}
