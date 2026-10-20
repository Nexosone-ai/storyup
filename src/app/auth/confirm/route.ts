import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * 이메일 링크 인증(회원가입 확인·비밀번호 재설정·이메일 변경).
 * token_hash + type를 verifyOtp로 검증한다 — PKCE code 교환과 달리 code_verifier
 * 쿠키가 필요 없어, 가입한 기기와 '다른 기기/브라우저'에서 링크를 열어도 인증된다.
 *
 * Supabase 이메일 템플릿의 확인 버튼을 다음으로 보내야 한다(예: 회원가입):
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // 비밀번호 재설정은 비밀번호 변경 화면으로.
      const dest = type === "recovery" ? "/update-password" : safeNext;
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=verify`);
}
