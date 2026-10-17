import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/queries";
import { getPlanId } from "@/lib/subscription";
import { facebookConfigured, facebookAuthUrl } from "@/lib/social/facebook";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Facebook 페이지 연결 시작 — 로그인 + Pro + 사업체 소유 확인 후 동의 화면으로.
 * business 쿼리로 대상 사업체, next로 복귀 경로를 받는다.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("business") || "";
  const next =
    url.searchParams.get("next") ||
    (businessId ? `/business/${businessId}/agent` : "/dashboard/businesses");
  const back = (q: string) =>
    NextResponse.redirect(
      `${SITE_URL}${next}${next.includes("?") ? "&" : "?"}fb=${q}`,
    );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.redirect(
      `${SITE_URL}/login?redirect=${encodeURIComponent(next)}`,
    );

  if (!facebookConfigured()) return back("unconfigured");

  const planId = await getPlanId(user.id);
  if (planId !== "pro") return back("not_pro");

  const business = businessId ? await getBusiness(businessId) : null;
  if (!business) return back("no_business");

  const state = crypto.randomUUID();
  const jar = await cookies();
  jar.set("fb_oauth", `${state}|${businessId}|${next}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(facebookAuthUrl(state));
}
