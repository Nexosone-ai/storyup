"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  inviteMemberAction,
  removeMemberAction,
  acceptInviteAction,
  declineInviteAction,
} from "@/app/dashboard/team/actions";
import type {
  TeamMemberRow,
  ReceivedInvite,
} from "@/app/dashboard/team/page";

export function TeamManager({
  ko,
  canManage,
  isStaff,
  seatLabel,
  usedSeats,
  team,
  received,
}: {
  ko: boolean;
  canManage: boolean;
  isStaff: boolean;
  seatLabel: string;
  usedSeats: number;
  team: TeamMemberRow[];
  received: ReceivedInvite[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [busy, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      if (res.error) setNote({ text: res.error, error: true });
      else {
        if (res.message) setNote({ text: res.message, error: false });
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      {/* 나에게 온 초대 / 내 직원 연결 */}
      {received.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted">
            {ko ? "받은 초대 · 연결" : "Invitations"}
          </h2>
          {received.map((r) => (
            <Card
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-sm">
                {r.status === "pending" ? (
                  <>
                    <b>{r.ownerLabel}</b>
                    {ko
                      ? " 님이 직원으로 초대했어요."
                      : " invited you as staff."}
                  </>
                ) : (
                  <>
                    <b>{r.ownerLabel}</b>
                    {ko ? " 계정의 직원으로 연결됨" : " · connected as staff"}
                  </>
                )}
              </p>
              <div className="flex gap-2">
                {r.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => run(() => acceptInviteAction(r.id))}
                    >
                      {ko ? "수락" : "Accept"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => run(() => declineInviteAction(r.id))}
                    >
                      {ko ? "거절" : "Decline"}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          ko ? "직원 연결을 해제할까요?" : "Disconnect?",
                        )
                      )
                        run(() => declineInviteAction(r.id));
                    }}
                  >
                    {ko ? "연결 해제" : "Disconnect"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 팀 관리 (소유자) */}
      {canManage ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted">
              {ko ? "직원 계정" : "Staff accounts"}
            </h2>
            <span className="text-xs text-muted">
              {ko ? "사용 " : "Using "}
              {usedSeats}/{seatLabel}
            </span>
          </div>

          <Card className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={ko ? "직원 이메일" : "Staff email"}
                className="w-64"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <Button
                disabled={busy || !email.trim()}
                onClick={() =>
                  run(async () => {
                    const res = await inviteMemberAction(email);
                    if (!res.error) setEmail("");
                    return res;
                  })
                }
              >
                {busy ? <Spinner className="size-4" /> : ko ? "초대" : "Invite"}
              </Button>
            </div>
            <p className="text-xs text-muted">
              {ko
                ? "초대한 직원이 같은 이메일로 STORYUP에 로그인해 수락하면 연결됩니다."
                : "The invitee accepts after logging in with the same email."}
            </p>
          </Card>

          {team.length > 0 && (
            <div className="space-y-2">
              {team.map((m) => (
                <Card
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="text-sm">{m.email}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={m.status === "active" ? "success" : "warning"}>
                      {m.status === "active"
                        ? ko
                          ? "연결됨"
                          : "Active"
                        : ko
                          ? "대기"
                          : "Pending"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => run(() => removeMemberAction(m.id))}
                    >
                      {ko ? "삭제" : "Remove"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        !isStaff && (
          <Card className="flex flex-col items-start gap-3 p-8">
            <p className="text-lg font-semibold">
              {ko
                ? "직원 계정은 Pro 플랜에서 추가할 수 있어요."
                : "Staff accounts are available on the Pro plan."}
            </p>
            <p className="text-sm text-muted">
              {ko
                ? "Pro는 소유자 포함 3개 계정까지, 직원 2명을 초대해 사업장을 함께 관리할 수 있어요."
                : "Pro allows up to 3 accounts (owner + 2 staff)."}
            </p>
            <ButtonLink href="/dashboard/plans">
              {ko ? "플랜 업그레이드" : "Upgrade plan"}
            </ButtonLink>
          </Card>
        )
      )}

      {note && (
        <p className={`text-sm ${note.error ? "text-danger" : "text-primary"}`}>
          {note.text}
        </p>
      )}
    </div>
  );
}
