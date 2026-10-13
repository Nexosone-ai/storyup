import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { chargeClick } from "@/lib/ads/charge";

export const dynamic = "force-dynamic";

/**
 * 광고 클릭 — CPC 과금 후 광고주 target_url로 302.
 * 방문자 식별은 bl_vid 쿠키(없으면 발급). 프리페치/프리뷰는 과금에서 제외.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ placementId: string }> },
) {
  const { placementId } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const store = await cookies();
  let vid = store.get("bl_vid")?.value;
  let newVid = false;
  if (!vid) {
    vid = randomUUID();
    newVid = true;
  }
  const visitorKey = user ? `user:${user.id}` : `anon:${vid}`;

  // 프리페치/프리뷰(iframe) 요청은 과금하지 않고 홈으로만.
  const purpose =
    request.headers.get("sec-purpose") || request.headers.get("purpose") || "";
  const isPrefetch = /prefetch/i.test(purpose);

  let target = "/";
  if (!isPrefetch) {
    target = await chargeClick(placementId, visitorKey, user?.id ?? null);
  }

  const dest = /^https?:\/\//i.test(target)
    ? target
    : new URL(target || "/", request.url).toString();
  const res = NextResponse.redirect(dest, 302);
  if (newVid && !user) {
    res.cookies.set("bl_vid", vid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
