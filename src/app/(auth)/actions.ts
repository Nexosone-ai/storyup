"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export interface AuthState {
  error?: string;
  message?: string;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "이미 가입된 이메일입니다. 로그인해주세요.";
  if (m.includes("password")) return "비밀번호는 6자 이상이어야 합니다.";
  if (m.includes("email")) return "유효한 이메일을 입력해주세요.";
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/dashboard");

  if (!email || !password) return { error: "이메일과 비밀번호를 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error.message) };

  redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password)
    return { error: "모든 항목을 입력해주세요." };
  if (password.length < 6)
    return { error: "비밀번호는 6자 이상이어야 합니다." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });
  if (error) return { error: friendly(error.message) };

  // If email confirmation is disabled, a session exists immediately.
  if (data.session) redirect("/dashboard");

  return {
    message:
      "확인 이메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해주세요",
  };
}

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = String(formData.get("redirect") ?? "/dashboard");
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  // 로컬(3001)과 프로덕션 어디서 열려도 현재 오리진으로 돌아오도록 헤더에서 추론
  const h = await headers();
  const origin = h.get("origin") ?? siteUrl;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error || !data.url) redirect("/login?error=auth");
  redirect(data.url);
}

export async function resetRequestAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "이메일을 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
  });
  if (error) return { error: friendly(error.message) };
  return { message: "비밀번호 재설정 링크를 이메일로 보냈습니다." };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
