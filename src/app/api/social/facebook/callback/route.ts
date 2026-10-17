import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/queries";
import { connectPages } from "@/lib/social/facebook";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** 동의 후 콜백 — 코드 교환 → 페이지 저장 → 복귀. 소유권 재검증. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const jar = await cookies();
  const raw = jar.get("fb_oauth")?.value ?? "";
  jar.delete("fb_oauth");
  const [savedState, businessId = "", next = "/dashboard/businesses"] =
    raw.split("|");

  const back = (q: string) =>
    NextResponse.redirect(
      `${SITE_URL}${next}${next.includes("?") ? "&" : "?"}fb=${q}`,
    );

  if (err || !code || !state || state !== savedState || !businessId)
    return back("error");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.redirect(
      `${SITE_URL}/login?redirect=${encodeURIComponent(next)}`,
    );

  // 소유권 재검증(쿠키 변조 방지).
  const business = await getBusiness(businessId);
  if (!business) return back("no_business");

  try {
    const count = await connectPages(businessId, user.id, code);
    return back(count > 0 ? "connected" : "nopage");
  } catch (e) {
    console.error("[facebook/callback]", e);
    return back("error");
  }
}
