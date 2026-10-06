import { NextResponse, type NextRequest } from "next/server";
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
  const next = searchParams.get("next") ?? "/dashboard";
  const ref = (searchParams.get("ref") ?? "").trim().toUpperCase();
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(`${origin}${safeNext}`);
      if (REF_RE.test(ref)) {
        if (data.user?.id) await attributeReferral(data.user.id, ref);
        res.cookies.set("su_ref", ref, {
          httpOnly: true,
          sameSite: "lax",
          maxAge: 7 * 86_400,
          path: "/",
        });
      }
      return res;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
