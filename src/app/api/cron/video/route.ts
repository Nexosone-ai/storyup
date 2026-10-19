import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { finalizeIfComplete } from "@/lib/video";

export const maxDuration = 120;

/**
 * 영상 작업 복구 크론 — 브라우저를 닫아 폴링이 끊긴 processing 작업을 서버가 완료 처리.
 * finalizeIfComplete의 원자적 claim으로 클라이언트 폴링과 겹쳐도 중복 차감되지 않는다.
 * Vercel Cron은 CRON_SECRET 설정 시 Authorization: Bearer 헤더를 자동 첨부한다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // 최근 24시간 내 처리 중 작업(너무 오래된 건 방치/정리 대상).
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: jobs } = await admin
    .from("video_jobs")
    .select("id, user_id, business_id, prompt, status_url, response_url")
    .eq("status", "processing")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(50);

  let done = 0,
    failed = 0,
    pending = 0;
  for (const job of jobs ?? []) {
    try {
      const state = await finalizeIfComplete(job);
      if (state.status === "done") done++;
      else if (state.status === "failed") failed++;
      else pending++;
    } catch (err) {
      console.error("[cron/video]", job.id, err);
      pending++;
    }
  }
  return NextResponse.json({ ok: true, checked: jobs?.length ?? 0, done, failed, pending });
}
