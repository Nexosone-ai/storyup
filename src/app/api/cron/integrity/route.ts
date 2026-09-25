import { NextResponse } from "next/server";
import { runIntegrityReport } from "@/lib/admin/integrity";

export const maxDuration = 60;

/**
 * 데이터 정합성 점검 크론 (vercel.json crons → 매일).
 * 결과를 integrity_reports에 적재하고, 이상이 있으면 에러 로그로 남긴다.
 * Vercel Cron은 CRON_SECRET 설정 시 Authorization: Bearer 헤더를 자동 첨부한다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await runIntegrityReport("cron");
  if (report.ok) {
    console.log("[cron/integrity] ok — 이상 없음");
  } else {
    const failed = report.checks.filter((c) => c.status !== "ok");
    console.error(
      "[cron/integrity] 이상 발견",
      report.issues,
      JSON.stringify(failed),
    );
  }
  return NextResponse.json({ ok: report.ok, issues: report.issues });
}
