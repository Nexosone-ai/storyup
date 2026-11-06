"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { unregisterClientAction } from "@/app/partner/actions";

/** 파트너 고객 카드의 '연결 해제' — 한 번 더 확인 후 실행. */
export function ClientUnlinkButton({
  clientUserId,
  ko = true,
}: {
  clientUserId: string;
  ko?: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirm)
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="text-xs text-muted hover:text-danger"
      >
        {ko ? "연결 해제" : "Unlink"}
      </button>
    );

  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-danger">{ko ? "해제할까요?" : "Unlink?"}</span>
      <Button
        size="sm"
        variant="danger"
        className="h-7 px-2.5 text-xs"
        disabled={busy}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await unregisterClientAction(clientUserId);
            if (res.error) setError(res.error);
            else router.refresh();
            setConfirm(false);
          })
        }
      >
        {ko ? "해제" : "Unlink"}
      </Button>
      <button type="button" onClick={() => setConfirm(false)} className="text-muted">
        {ko ? "취소" : "Cancel"}
      </button>
      {error && <span className="text-danger">{error}</span>}
    </span>
  );
}
