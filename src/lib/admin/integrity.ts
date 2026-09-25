import { createAdminClient } from "@/lib/supabase/server";

/**
 * 데이터 정합성 점검 — DB 함수 integrity_report()가 auth 교차 조회까지 수행하고,
 * 결과를 integrity_reports 테이블에 적재한다. cron(매일)과 관리자 온디맨드가 공유.
 */

export type CheckStatus = "ok" | "warn" | "error";

export interface IntegrityCheck {
  key: string;
  label: string;
  count: number;
  status: CheckStatus;
}

export interface IntegrityReport {
  generatedAt: string;
  ok: boolean;
  issues: number;
  checks: IntegrityCheck[];
}

export interface StoredIntegrityReport extends IntegrityReport {
  storedAt: string;
  source: string;
}

function parseReport(raw: unknown): IntegrityReport {
  const r = (raw ?? {}) as {
    generated_at?: string;
    ok?: boolean;
    issues?: number;
    checks?: IntegrityCheck[];
  };
  return {
    generatedAt: r.generated_at ?? new Date().toISOString(),
    ok: r.ok ?? true,
    issues: r.issues ?? 0,
    checks: Array.isArray(r.checks) ? r.checks : [],
  };
}

/** 정합성 검사 실행 → 결과 저장 → 파싱된 리포트 반환. */
export async function runIntegrityReport(
  source: "cron" | "manual",
): Promise<IntegrityReport> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("integrity_report");
  if (error) throw new Error(`integrity_report 실행 실패: ${error.message}`);

  const report = parseReport(data);
  // 결과 적재 (실패해도 리포트 자체는 반환)
  await admin.from("integrity_reports").insert({
    source,
    ok: report.ok,
    issues: report.issues,
    report: data as never,
  });
  return report;
}

/** 가장 최근 저장된 리포트. 없으면 null. */
export async function getLatestIntegrityReport(): Promise<StoredIntegrityReport | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("integrity_reports")
      .select("created_at, source, report")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      ...parseReport(data.report),
      storedAt: data.created_at,
      source: data.source,
    };
  } catch {
    return null;
  }
}
