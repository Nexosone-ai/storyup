import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCode,
  getChannel,
  saveConnection,
  getRefreshToken,
} from "@/lib/youtube";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** 구글 동의 후 콜백 — 코드 교환 → 채널 조회 → refresh_token 저장 → 복귀. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const jar = await cookies();
  const raw = jar.get("yt_oauth")?.value ?? "";
  jar.delete("yt_oauth");
  const [savedState, next = "/dashboard/businesses"] = raw.split("|");

  const back = (q: string) =>
    NextResponse.redirect(
      `${SITE_URL}${next}${next.includes("?") ? "&" : "?"}yt=${q}`,
    );

  if (err || !code || !state || state !== savedState) return back("error");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.redirect(`${SITE_URL}/login?redirect=${encodeURIComponent(next)}`);

  try {
    const tok = await exchangeCode(code);
    // refresh_token은 최초 동의에만 옴. 없으면 기존 저장분 유지(이미 연결된 경우).
    if (!tok.refresh_token && !(await getRefreshToken(user.id)))
      return back("notoken");
    const channel = await getChannel(tok.access_token);
    await saveConnection({
      userId: user.id,
      refreshToken: tok.refresh_token,
      channelId: channel.id,
      channelTitle: channel.title,
      scope: tok.scope,
    });
    return back("connected");
  } catch (e) {
    console.error("[youtube/callback]", e);
    return back("error");
  }
}
