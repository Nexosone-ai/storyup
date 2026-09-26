import { NextResponse } from "next/server";
import { runExpiryReminders } from "@/lib/payments/expiry";

export const maxDuration = 120;

/**
 * 구독 만기 알림 크론 (vercel.json crons → 매일).
 * 만기 7일 이내(수동 재결제 구독)에 인앱+웹푸시(매일), 3일 전부터 이메일(1회).
 * Vercel Cron은 CRON_SECRET 설정 시 Authorization: Bearer 헤더를 자동 첨부한다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runExpiryReminders();
  console.log("[cron/expiry]", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
