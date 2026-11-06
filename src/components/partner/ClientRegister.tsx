"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import {
  registerClientAction,
  cancelClientInviteAction,
} from "@/app/partner/actions";
import type { PendingInviteRow } from "@/lib/partner/clients";

export function ClientRegister({
  pending,
  ko = true,
}: {
  pending: PendingInviteRow[];
  ko?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const e = email.trim();
    if (!e) return;
    setMsg(null);
    setError(null);
    start(async () => {
      const res = await registerClientAction(e);
      if (res.error) setError(res.error);
      else {
        setMsg(res.message ?? null);
        setEmail("");
        router.refresh();
      }
    });
  };

  const cancel = (id: string) =>
    start(async () => {
      setMsg(null);
      setError(null);
      const res = await cancelClientInviteAction(id);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Icon.plus className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">
          {ko ? "고객 등록 (이메일)" : "Register a client (email)"}
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted">
        {ko
          ? "고객(가맹점)의 스토리업 계정 이메일을 등록하면 바로 내 고객으로 연결되어 사업장을 대행할 수 있어요. 아직 가입 전이면 그 이메일로 가입하는 순간 자동 연결됩니다."
          : "Enter the client's STORYUP account email to manage their businesses right away. If they haven't signed up yet, they are linked automatically when they do."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={ko ? "고객 이메일" : "Client email"}
          disabled={busy}
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
        />
        <Button size="sm" className="h-10" onClick={submit} disabled={busy || !email.trim()}>
          {busy ? "처리 중…" : ko ? "고객 등록" : "Register"}
        </Button>
      </div>
      {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {pending.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">
            {ko ? "가입 대기 중" : "Waiting for sign-up"} ({pending.length})
          </p>
          <ul className="mt-1 divide-y divide-border text-sm">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">{p.clientEmail}</span>
                <button
                  type="button"
                  onClick={() => cancel(p.id)}
                  disabled={busy}
                  className="shrink-0 text-xs text-muted hover:text-danger disabled:opacity-50"
                >
                  {ko ? "취소" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
