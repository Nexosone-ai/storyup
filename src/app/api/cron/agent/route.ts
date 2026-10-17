import { NextResponse } from "next/server";
import { runDueRoutines } from "@/lib/ai/agent/autopilot";

export const maxDuration = 300;

/**
 * AI 오토파일럿 크론 (vercel.json crons).
 * enabled 루틴 중 실행 시각이 도래한 것을 선점·실행(생성/게시 또는 제안)한다.
 * Vercel Cron은 CRON_SECRET 설정 시 Authorization: Bearer 헤더를 자동 첨부한다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runDueRoutines();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron/agent]", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
