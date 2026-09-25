"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { runIntegrityNowAction } from "@/app/dashboard/admin/integrity/actions";
import type {
  StoredIntegrityReport,
  CheckStatus,
} from "@/lib/admin/integrity";

const TONE: Record<CheckStatus, "success" | "warning" | "danger"> = {
  ok: "success",
  warn: "warning",
  error: "danger",
};
const STATUS_LABEL: Record<CheckStatus, string> = {
  ok: "정상",
  warn: "주의",
  error: "이상",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminIntegrityView({
  latest,
}: {
  latest: StoredIntegrityReport | null;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const run = () =>
    start(async () => {
      setNote(null);
      const res = await runIntegrityNowAction();
      if (res.error) setNote(res.error);
      else router.refresh();
    });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">데이터 정합성</p>
          <h2 className="text-xl font-semibold tracking-tight">정합성 점검</h2>
          <p className="mt-1 text-sm text-muted">
            매일 자동으로 점검하며, 아래 버튼으로 즉시 다시 확인할 수 있어요.
          </p>
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? <Spinner className="size-4" /> : "지금 점검"}
        </Button>
      </div>

      {note && <p className="text-sm text-danger">{note}</p>}

      {!latest ? (
        <Card>
          <p className="text-sm text-muted">
            아직 점검 기록이 없습니다. &lsquo;지금 점검&rsquo;을 눌러 첫 점검을
            실행하세요.
          </p>
        </Card>
      ) : (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{latest.ok ? "✅" : "⚠️"}</span>
              <div>
                <p className="font-semibold">
                  {latest.ok
                    ? "모든 검사 통과"
                    : `${latest.issues}개 항목에서 이상 발견`}
                </p>
                <p className="text-xs text-muted">
                  마지막 점검 {fmt(latest.storedAt)} ·{" "}
                  {latest.source === "cron" ? "자동(매일)" : "수동 실행"}
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            {latest.checks.map((c) => (
              <Card
                key={c.key}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    <p className="truncate font-medium">{c.label}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">{c.key}</p>
                </div>
                <p
                  className={`tnum shrink-0 text-lg font-bold ${
                    c.status === "ok" ? "text-muted" : "text-danger"
                  }`}
                >
                  {c.count.toLocaleString()}건
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
