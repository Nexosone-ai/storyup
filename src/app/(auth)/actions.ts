"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getLocale } from "@/lib/i18n";

export interface AuthState {
  error?: string;
  message?: string;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function friendly(msg: string, ko: boolean): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login"))
    return ko
      ? "이메일 또는 비밀번호가 올바르지 않습니다."
      : "Incorrect email or password.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return ko
      ? "이미 가입된 이메일입니다. 로그인해주세요."
      : "This email is already registered. Please log in.";
  if (m.includes("password"))
    return ko
      ? "비밀번호는 6자 이상이어야 합니다."
      : "Password must be at least 6 characters.";
  if (m.includes("email"))
    return ko ? "유효한 이메일을 입력해주세요." : "Please enter a valid email.";
  return ko
    ? "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요."
    : "We could not process the request. Please try again shortly.";
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const ko = (await getLocale()) === "ko";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/dashboard");

  if (!email || !password)
    return {
      error: ko
        ? "이메일과 비밀번호를 입력해주세요."
        : "Please enter your email and password.",
    };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error.message, ko) };

  redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const ko = (await getLocale()) === "ko";
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password)
    return {
      error: ko ? "모든 항목을 입력해주세요." : "Please fill in all fields.",
    };
  if (password.length < 6)
    return {
      error: ko
        ? "비밀번호는 6자 이상이어야 합니다."
        : "Password must be at least 6 characters.",
    };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });
  if (error) return { error: friendly(error.message, ko) };

  // If email confirmation is disabled, a session exists immediately.
  if (data.session) redirect("/dashboard");

  return {
    message: ko
      ? "확인 이메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해주세요"
      : "Confirmation email sent. Click the link in the email to finish signing up.",
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
  const ko = (await getLocale()) === "ko";
  const email = String(formData.get("email") ?? "").trim();
  if (!email)
    return { error: ko ? "이메일을 입력해주세요." : "Please enter your email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/update-password`,
  });
  if (error) return { error: friendly(error.message, ko) };
  return {
    message: ko
      ? "비밀번호 재설정 링크를 이메일로 보냈습니다."
      : "We emailed you a password reset link.",
  };
}

export async function updatePasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const ko = (await getLocale()) === "ko";
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6)
    return {
      error: ko
        ? "비밀번호는 6자 이상이어야 합니다."
        : "Password must be at least 6 characters.",
    };
  if (password !== confirm)
    return {
      error: ko
        ? "비밀번호가 서로 일치하지 않습니다."
        : "The passwords do not match.",
    };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      error: ko
        ? "재설정 링크가 만료되었거나 올바르지 않습니다. 재설정 메일을 다시 요청해주세요."
        : "The reset link has expired or is invalid. Please request a new one.",
    };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendly(error.message, ko) };

  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
