"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  invitePartnerShareAction,
  revokeShareAction,
  acceptShareAction,
  declineShareAction,
} from "@/app/dashboard/share/actions";
import type { OwnerShareRow, IncomingShareRow, SharedAccount } from "@/lib/accountShare";

const STATUS_LABEL: Record<string, string> = {
  pending: "수락 대기",
  accepted: "접근중",
  revoked: "해제됨",
};

export function AccountShareView({
  ownerShares,
  incoming,
  sharedAccounts,
}: {
  ownerShares: OwnerShareRow[];
  incoming: IncomingShareRow[];
  sharedAccounts: SharedAccount[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) => {
    setMsg(null);
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        setMsg(res.message ?? null);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">계정 공유 (파트너)</h1>
        <p className="mt-1.5 text-sm text-muted">
          내 스토리업 계정을 파트너에게 이메일로 공유하면, 파트너가 수락 후 자기 계정으로
          로그인해 내 사업장에서 작업할 수 있어요. (결제·구독 등 계정 설정은 공유되지 않아요.)
        </p>
      </div>

      {msg && <p className="text-sm text-primary">{msg}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {/* 소유자: 파트너 초대 */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 font-semibold">파트너 초대</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="파트너 이메일"
            disabled={busy}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
          />
          <Button
            onClick={() => {
              const e = email.trim();
              if (!e) return;
              run(async () => {
                const r = await invitePartnerShareAction(e);
                if (!r.error) setEmail("");
                return r;
              });
            }}
            disabled={busy || !email.trim()}
          >
            {busy ? <Spinner className="size-4" /> : "초대"}
          </Button>
        </div>

        {ownerShares.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {ownerShares.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{s.partnerName || s.partnerEmail}</span>
                  {s.partnerName && <span className="text-muted"> · {s.partnerEmail}</span>}
                  <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => run(() => revokeShareAction(s.id))}
                  disabled={busy}
                  className="shrink-0 text-xs text-danger hover:underline disabled:opacity-50"
                >
                  {s.status === "accepted" ? "접근 해제" : "취소"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 파트너: 들어온 초대 */}
      {incoming.length > 0 && (
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="mb-2 font-semibold">들어온 공유 초대</p>
          <ul className="divide-y divide-border">
            {incoming.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <b>{inv.ownerName || inv.ownerEmail || "계정"}</b> 님이 계정을 공유했어요.
                </span>
                <span className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => run(() => acceptShareAction(inv.id))} disabled={busy}>
                    수락
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(() => declineShareAction(inv.id))}
                    disabled={busy}
                  >
                    거절
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 파트너: 접근 중인 계정 */}
      {sharedAccounts.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-2 font-semibold">접근 중인 계정</p>
          <ul className="space-y-3">
            {sharedAccounts.map((acc) => (
              <li key={acc.ownerUserId}>
                <p className="text-sm font-medium">{acc.ownerName || "공유 계정"}</p>
                {acc.businesses.length > 0 ? (
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {acc.businesses.map((b) => (
                      <li key={b.id}>
                        <Link
                          href={`/business/${b.id}`}
                          className="rounded-lg border border-border px-3 py-1.5 text-sm text-primary hover:border-primary/60"
                        >
                          {b.name || "사업장"} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted">아직 사업장이 없어요.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
