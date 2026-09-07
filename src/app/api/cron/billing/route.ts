import { NextResponse } from "next/server";
import { runBillingCycle } from "@/lib/payments/billing";

export const maxDuration = 300;

/**
 * 구독 갱신 크론 (vercel.json crons → 매일 새벽).
 * 만기 도래 구독을 재청구하거나(빌링키), 체험/해지 예약 구독을 종료한다.
 * Vercel Cron은 CRON_SECRET 설정 시 Authorization: Bearer 헤더를 자동 첨부한다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runBillingCycle();
  console.log("[cron/billing]", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
