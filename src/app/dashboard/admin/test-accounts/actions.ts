"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";

export interface TestAccountState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const MAX_DAYS = 365;

function expiryIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.min(MAX_DAYS, Math.max(1, Math.round(days))));
  return d.toISOString();
}

/** Pro 구독(만료일 포함)을 설정한다. 만료 시 getPlanId가 자동으로 free 처리. */
async function setProSubscription(userId: string, expires: string) {
  const admin = createAdminClient();
  return admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: "pro",
      status: "active",
      current_period_end: expires,
      billing_key: null,
      cancel_at_period_end: false,
      billing_failures: 0,
      trial: true, // 결제 없는 테스트/체험 성격
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

/**
 * 영업용 테스트 계정 생성 — 아이디(이메일)·비밀번호 지정, Pro 플랜, 사용 기간(일).
 * 실제 계정은 Supabase Auth에 만들고(이메일 인증 완료 처리), Pro/만료는
 * subscriptions에 기록한다. test_accounts에 관리용 메타데이터를 남긴다.
 */
export async function createTestAccountAction(input: {
  email: string;
  password: string;
  days: number;
  label?: string;
}): Promise<TestAccountState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const me = await getUser();

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { error: "올바른 이메일(아이디)을 입력해주세요." };
  if (!password || password.length < 8)
    return { error: "비밀번호는 8자 이상이어야 합니다." };

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { test_account: true, label: input.label?.trim() || null },
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? "";
    return {
      error: /already|registered|exists/i.test(msg)
        ? "이미 가입된 이메일입니다. 다른 아이디를 사용해주세요."
        : "계정 생성에 실패했습니다. 다시 시도해주세요.",
    };
  }

  const userId = created.user.id;
  const expires = expiryIso(input.days);

  const { error: subErr } = await setProSubscription(userId, expires);
  if (subErr) {
    // 구독 설정 실패 시 생성한 계정을 롤백한다.
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { error: "Pro 설정에 실패했습니다. 다시 시도해주세요." };
  }

  await admin.from("test_accounts").insert({
    user_id: userId,
    email,
    label: input.label?.trim() || null,
    expires_at: expires,
    created_by: me?.id ?? null,
  });

  revalidatePath("/dashboard/admin/test-accounts");
  return {
    ok: true,
    message: `${email} 테스트 계정을 만들었어요 (Pro · ${new Date(expires).toLocaleDateString("ko-KR")}까지).`,
  };
}

/** 사용 기간 연장 — subscriptions 만료일과 test_accounts.expires_at을 오늘+일수로 갱신. */
export async function extendTestAccountAction(
  id: string,
  days: number,
): Promise<TestAccountState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("test_accounts")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "테스트 계정을 찾을 수 없습니다." };

  const expires = expiryIso(days);
  const { error } = await setProSubscription(row.user_id, expires);
  if (error) return { error: "연장에 실패했습니다." };
  await admin.from("test_accounts").update({ expires_at: expires }).eq("id", id);

  revalidatePath("/dashboard/admin/test-accounts");
  return {
    ok: true,
    message: `${new Date(expires).toLocaleDateString("ko-KR")}까지로 연장했어요.`,
  };
}

/** 테스트 계정 삭제 — 실제 Auth 계정까지 완전 삭제(연결 데이터 cascade). */
export async function deleteTestAccountAction(
  id: string,
): Promise<TestAccountState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("test_accounts")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "테스트 계정을 찾을 수 없습니다." };

  // Auth 계정 삭제 — subscriptions 등 user_id FK는 cascade로 함께 정리된다.
  const { error } = await admin.auth.admin.deleteUser(row.user_id);
  if (error) return { error: "계정 삭제에 실패했습니다." };
  await admin.from("test_accounts").delete().eq("id", id);

  revalidatePath("/dashboard/admin/test-accounts");
  return { ok: true, message: "테스트 계정을 삭제했어요." };
}
