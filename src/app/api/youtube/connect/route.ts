import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getPlanId } from "@/lib/subscription";
import { youtubeConfigured, youtubeAuthUrl } from "@/lib/youtube";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * 유튜브 연결 시작 — 로그인 + Pro 확인 후 구글 동의 화면으로 보낸다.
 * next 쿼리로 돌아올 경로(보통 SNS 스튜디오)를 받아 콜백에서 복귀한다.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/dashboard/businesses";
  const back = (q: string) =>
    NextResponse.redirect(
      `${SITE_URL}${next}${next.includes("?") ? "&" : "?"}yt=${q}`,
    );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.redirect(`${SITE_URL}/login?redirect=${encodeURIComponent(next)}`);

  if (!youtubeConfigured()) return back("unconfigured");

  const planId = await getPlanId(user.id);
  if (planId !== "pro" && planId !== "partner") return back("not_pro");

  // CSRF 방지 state + 복귀 경로를 쿠키에 보관(콜백에서 검증).
  const state = crypto.randomUUID();
  const jar = await cookies();
  jar.set("yt_oauth", `${state}|${next}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(youtubeAuthUrl(state));
}
