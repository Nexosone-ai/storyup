"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";

export interface TestAccountState {
  ok?: boolean;
  error?: string;
  message?: string;
  /** 1회성 비밀번호 설정 링크(저장하지 않음 — 응답으로만 전달). */
  link?: string;
}

const MAX_DAYS = 365;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function expiryIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.min(MAX_DAYS, Math.max(1, Math.round(days))));
  return d.toISOString();
}

/** 무작위 강력 비밀번호 — 계정을 유효하게 만들 뿐, 어디에도 저장·노출하지 않는다.
 *  영업자는 발급된 재설정 링크로 자기 비밀번호를 직접 설정한다. */
function randomSecret(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}Aa1!`;
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

/** 이메일로 비밀번호 설정(복구) 링크 1회 발급 — 저장하지 않고 반환만 한다. */
async function makeResetLink(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${SITE_URL}/update-password` },
  });
  if (error) return null;
  return data?.properties?.action_link ?? null;
}

/**
 * 영업용 테스트 계정 생성 — 아이디(이메일)·Pro 플랜·사용 기간(일).
 * 비밀번호는 저장하지 않는다: 무작위 비번으로 계정을 만들고, 영업자가 직접
 * 설정하도록 '비밀번호 설정 링크'를 1회 발급해 응답으로만 돌려준다.
 */
export async function createTestAccountAction(input: {
  email: string;
  days: number;
  label?: string;
}): Promise<TestAccountState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const me = await getUser();

  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { error: "올바른 이메일(아이디)을 입력해주세요." };

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: randomSecret(),
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

  const link = await makeResetLink(email);
  revalidatePath("/dashboard/admin/test-accounts");
  return {
    ok: true,
    message: link
      ? `${email} 생성 완료 (Pro · ${new Date(expires).toLocaleDateString("ko-KR")}까지). 아래 '비밀번호 설정 링크'를 영업자에게 전달하세요.`
      : `${email} 생성 완료. 링크 발급에 실패했으니 '재설정 링크'를 다시 눌러주세요.`,
    link: link ?? undefined,
  };
}

/** 비밀번호 설정/재설정 링크를 1회 발급 — 저장하지 않고 응답으로만 전달. */
export async function generateResetLinkAction(
  id: string,
): Promise<TestAccountState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("test_accounts")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  if (!row?.email) return { error: "테스트 계정을 찾을 수 없습니다." };

  const link = await makeResetLink(row.email);
  if (!link) return { error: "링크 발급에 실패했습니다. 다시 시도해주세요." };
  return {
    ok: true,
    message: "비밀번호 설정 링크를 발급했어요. 영업자에게 전달하세요(1회성).",
    link,
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

  const { error } = await admin.auth.admin.deleteUser(row.user_id);
  if (error) return { error: "계정 삭제에 실패했습니다." };
  await admin.from("test_accounts").delete().eq("id", id);

  revalidatePath("/dashboard/admin/test-accounts");
  return { ok: true, message: "테스트 계정을 삭제했어요." };
}
