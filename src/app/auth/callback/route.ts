import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { attributeReferral } from "@/lib/gamification/referral";

const REF_RE = /^[A-Z0-9]{4,12}$/;

/**
 * Handles the redirect from Supabase email links (signup confirmation,
 * password reset) and OAuth (카카오·구글·페이스북). Exchanges the code for a
 * session, then forwards on.
 *
 * ?ref= 추천 코드: 소셜 로그인 시작 액션이 redirectTo에 실어 보낸 값.
 * 쿠키가 끊긴 브라우저에서도 귀속되도록 세션 교환 직후 바로 귀속하고,
 * 대시보드가 다시 읽을 수 있게 쿠키도 복원한다. (attributeReferral은 멱등)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  const ref = (searchParams.get("ref") ?? "").trim().toUpperCase();
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  const setRefAnd = async (res: NextResponse, userId?: string) => {
    if (REF_RE.test(ref)) {
      if (userId) await attributeReferral(userId, ref);
      res.cookies.set("su_ref", ref, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 86_400,
        path: "/",
      });
    }
    return res;
  };

  // 1) PKCE code 교환(OAuth·같은 브라우저 이메일 링크).
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return setRefAnd(NextResponse.redirect(`${origin}${safeNext}`), data.user?.id);
  }

  // 2) token_hash 검증(기기 독립적). code가 없거나 교환 실패 시 폴백.
  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const dest = type === "recovery" ? "/update-password" : safeNext;
      return setRefAnd(NextResponse.redirect(`${origin}${dest}`), data.user?.id);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
