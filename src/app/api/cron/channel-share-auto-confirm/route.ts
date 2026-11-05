import { NextResponse } from "next/server";
import { CHANNEL_ADS_ENABLED } from "@/lib/channelAds/config";
import { autoConfirmDueShares } from "@/lib/channelAds/settlement";

export const maxDuration = 120;

/**
 * 채널 공유 광고 자동확정 크론 (vercel.json crons).
 * 증빙 제출(shared) 후 기한(auto_confirm_at)이 지난 의뢰를 자동으로 확정(settled)하고
 * 정산을 지급 대기(pending)로 전환한다. 실제 송금은 하지 않는다.
 * Vercel Cron은 CRON_SECRET 설정 시 Authorization: Bearer 헤더를 자동 첨부한다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!CHANNEL_ADS_ENABLED) {
    return NextResponse.json({ ok: true, skipped: "disabled", confirmed: 0 });
  }
  try {
    const { confirmed } = await autoConfirmDueShares();
    return NextResponse.json({ ok: true, confirmed });
  } catch (err) {
    console.error("[cron/channel-share-auto-confirm]", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
