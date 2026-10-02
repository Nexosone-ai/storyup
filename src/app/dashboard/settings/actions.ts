"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { deleteAccount } from "@/lib/account/deletion";
import type { SimpleState } from "@/app/dashboard/actions";

// "use server" 모듈은 async 함수만 export할 수 있어 확인 문구는 UI와 각각 둔다.
// (DeleteAccountSection.tsx의 문구와 동일해야 함)
const DELETE_CONFIRM_PHRASE = { ko: "삭제", en: "DELETE" } as const;

/** 로그인한 사용자가 자기 계정을 삭제한다(회원탈퇴). 성공 시 /goodbye로 이동. */
export async function deleteAccountAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const ko = (await getLocale()) === "ko";
  const confirm = String(formData.get("confirm") ?? "").trim();
  const reason = String(formData.get("reason") ?? "")
    .trim()
    .slice(0, 500);

  const expected = ko ? DELETE_CONFIRM_PHRASE.ko : DELETE_CONFIRM_PHRASE.en;
  if (confirm !== expected)
    return {
      error: ko
        ? `확인 문구 "${expected}"를 정확히 입력해주세요.`
        : `Type "${expected}" exactly to confirm.`,
    };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

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
