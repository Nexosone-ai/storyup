"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { AdminDomainRow } from "@/app/dashboard/admin/domains/page";
import { setDomainStatusAction } from "@/app/dashboard/admin/domains/actions";

function tone(status: AdminDomainRow["status"]) {
  return status === "active"
    ? "success"
    : status === "error"
      ? "danger"
      : "warning";
}

export function AdminDomainsView({ rows }: { rows: AdminDomainRow[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();

  const set = (id: string, status: AdminDomainRow["status"]) =>
    start(async () => {
      const res = await setDomainStatusAction(id, status);
      if (res.error) alert(res.error);
      else router.refresh();
    });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">개인 도메인</h1>
        <p className="mt-1 text-sm text-muted">
          Vercel 프로젝트(nexosone/storyup)에 도메인을 추가하고 DNS·SSL이
          확인되면 <b>활성화</b>하세요. 활성화하면 미들웨어가 해당 도메인을 사업장
          사이트로 연결합니다.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          연결 요청된 도메인이 없습니다.
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm font-semibold">{r.domain}</span>
              <Badge tone={tone(r.status)}>
                {r.status === "active"
                  ? "활성"
                  : r.status === "error"
                    ? "오류"
                    : "대기"}
              </Badge>
            </div>
            <p className="text-xs text-muted">
              {r.businessName}
              {r.slug ? ` · /site/${r.slug}` : " · (사이트 미공개)"} ·{" "}
              {new Date(r.createdAt).toLocaleDateString("ko-KR")}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {r.status !== "active" && (
                <Button size="sm" disabled={busy} onClick={() => set(r.id, "active")}>
                  활성화
                </Button>
              )}
              {r.status !== "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => set(r.id, "pending")}
                >
                  대기로
                </Button>
              )}
              {r.status !== "error" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => set(r.id, "error")}
                >
                  오류 표시
                </Button>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
