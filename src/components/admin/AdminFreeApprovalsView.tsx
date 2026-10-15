"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  approveFreeReapplyAction,
  rejectFreeReapplyAction,
} from "@/app/dashboard/admin/free-approvals/actions";
import type { FreeReapplyRow } from "@/lib/freeAccess";

/** 관리자 — 무료 플랜 블로그 재신청 승인/반려. */
export function AdminFreeApprovalsView({ rows }: { rows: FreeReapplyRow[] }) {
  const [list, setList] = useState(rows);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = (id: string, kind: "approve" | "reject") => {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const res =
        kind === "approve"
          ? await approveFreeReapplyAction(id)
          : await rejectFreeReapplyAction(id);
      if (res.error) setError(res.error);
      else setList((l) => l.filter((r) => r.id !== id));
      setBusyId(null);
    });
  };

  const pendings = list.filter((r) => r.status === "pending");
  const others = list.filter((r) => r.status !== "pending");

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight">무료 재신청 승인</h2>
        <p className="mt-1 text-sm text-muted">
          무료 플랜 사용자가 한 달 이용 후 재신청한 요청입니다. 승인하면 승인
          시점부터 1개월간 블로그(하루 1개·월 30개)를 다시 이용할 수 있어요.
        </p>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <h3 className="mb-2 text-sm font-semibold">
        대기 중 {pendings.length > 0 && `(${pendings.length})`}
      </h3>
      {pendings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          대기 중인 재신청이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {pendings.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div className="text-sm">
                <p className="font-medium">{r.email ?? r.userId}</p>
                <p className="text-xs text-muted">
                  재신청{" "}
                  {new Date(r.requestedAt ?? r.createdAt).toLocaleString("ko-KR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => act(r.id, "approve")}
                  disabled={pending && busyId === r.id}
                >
                  승인
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(r.id, "reject")}
                  disabled={pending && busyId === r.id}
                >
                  반려
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 text-sm font-semibold">최근 반려</h3>
          <ul className="space-y-1.5">
            {others.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2 text-sm text-muted"
              >
                <span>{r.email ?? r.userId}</span>
                <span className="text-xs">반려됨</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
