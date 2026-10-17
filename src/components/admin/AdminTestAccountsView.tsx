"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  createTestAccountAction,
  extendTestAccountAction,
  deleteTestAccountAction,
  generateResetLinkAction,
} from "@/app/dashboard/admin/test-accounts/actions";

export interface TestAccountRow {
  id: string;
  email: string | null;
  label: string | null;
  expiresAt: string | null;
  createdAt: string;
  expired: boolean;
}

const DAY_OPTIONS = [7, 14, 30, 60, 90];

/** 1회성 비밀번호 설정 링크 표시(저장하지 않는 값). */
function LinkBox({ url, onCopy }: { url: string; onCopy: (t: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft/20 px-3 py-2 text-xs">
      <span className="font-medium text-primary">비밀번호 설정 링크(1회성)</span>
      <code className="min-w-0 flex-1 truncate font-mono text-foreground">
        {url}
      </code>
      <button
        type="button"
        onClick={() => onCopy(url)}
        className="shrink-0 font-medium text-primary underline-offset-2 hover:underline"
      >
        복사
      </button>
    </div>
  );
}

export function AdminTestAccountsView({ rows }: { rows: TestAccountRow[] }) {
  const [list, setList] = useState(rows);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(30);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // 발급된 1회성 설정 링크(저장 안 함 — 화면에서만 잠깐 보여준다).
  const [links, setLinks] = useState<Record<string, string>>({});

  const copyText = (t: string) => {
    navigator.clipboard?.writeText(t).catch(() => {});
    setMsg("복사했어요.");
  };

  const create = () => {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await createTestAccountAction({ email, days, label });
      if (res.error) {
        setError(res.error);
        return;
      }
      setMsg(res.message ?? "생성됐어요.");
      if (res.link) setLinks((m) => ({ ...m, create: res.link as string }));
      setEmail("");
      setLabel("");
      setList((l) => [
        {
          id: `tmp-${Date.now()}`,
          email: email.trim().toLowerCase(),
          label: label.trim() || null,
          expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
          createdAt: new Date().toISOString(),
          expired: false,
        },
        ...l,
      ]);
    });
  };

  const genLink = (id: string) => {
    setBusyId(id);
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await generateResetLinkAction(id);
      if (res.error) setError(res.error);
      else {
        setMsg(res.message ?? "링크를 발급했어요.");
        if (res.link) setLinks((m) => ({ ...m, [id]: res.link as string }));
      }
      setBusyId(null);
    });
  };

  const extend = (id: string, d: number) => {
    setBusyId(id);
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await extendTestAccountAction(id, d);
      if (res.error) setError(res.error);
      else {
        setMsg(res.message ?? "연장됐어요.");
        setList((l) =>
          l.map((r) =>
            r.id === id
              ? {
                  ...r,
                  expiresAt: new Date(Date.now() + d * 86400000).toISOString(),
                  expired: false,
                }
              : r,
          ),
        );
      }
      setBusyId(null);
    });
  };

  const remove = (id: string, email: string | null) => {
    if (
      !confirm(
        `${email ?? "이 계정"}을(를) 완전히 삭제할까요? 되돌릴 수 없습니다.`,
      )
    )
      return;
    setBusyId(id);
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await deleteTestAccountAction(id);
      if (res.error) setError(res.error);
      else {
        setMsg(res.message ?? "삭제됐어요.");
        setList((l) => l.filter((r) => r.id !== id));
      }
      setBusyId(null);
    });
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("ko-KR") : "—";

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight">테스트 계정 관리</h2>
        <p className="mt-1 text-sm text-muted">
          영업자에게 줄 테스트 계정을 만듭니다. 아이디(이메일)와 사용 기간을
          지정하면 Pro 플랜으로 설정되고, 기간이 끝나면 자동으로 일반(무료)으로
          전환됩니다. 비밀번호는 저장하지 않고, 영업자가 직접 설정하도록{" "}
          <strong>1회성 설정 링크</strong>를 발급해 전달합니다.
        </p>
      </div>

      {/* 생성 폼 */}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-muted">
              아이디 (이메일)
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sales-test1@example.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-muted">
              메모 (선택 — 영업자 이름 등)
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 김영업 / 부산팀"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-muted">사용 기간</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-primary"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={create} disabled={pending}>
            {pending && !busyId ? <Spinner className="size-4" /> : null}
            테스트 계정 생성
          </Button>
          <span className="text-xs text-muted">
            생성 즉시 Pro로 {days}일간 이용할 수 있어요.
          </span>
        </div>
        {links.create && (
          <div className="mt-3">
            <LinkBox url={links.create} onCopy={copyText} />
          </div>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        {msg && <p className="mt-3 text-sm text-primary">{msg}</p>}
      </div>

      {/* 목록 */}
      <h3 className="mb-2 mt-8 text-sm font-semibold">
        생성된 테스트 계정 {list.length > 0 && `(${list.length})`}
      </h3>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          아직 만든 테스트 계정이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => {
            const expired = r.expired;
            const temp = r.id.startsWith("tmp-");
            return (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">
                      {r.email ?? r.id}
                      {r.label && (
                        <span className="ml-2 text-xs text-muted">{r.label}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      Pro · {fmt(r.expiresAt)}까지
                      {expired ? (
                        <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-600">
                          만료됨
                        </span>
                      ) : (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-600">
                          사용중
                        </span>
                      )}
                    </p>
                  </div>
                  {!temp && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => genLink(r.id)}
                        disabled={pending && busyId === r.id}
                      >
                        비밀번호 링크
                      </Button>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (v > 0) extend(r.id, v);
                          e.currentTarget.value = "";
                        }}
                        disabled={pending && busyId === r.id}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                      >
                        <option value="">기간 연장…</option>
                        {DAY_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            오늘+{d}일
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => remove(r.id, r.email)}
                        disabled={pending && busyId === r.id}
                      >
                        삭제
                      </Button>
                    </div>
                  )}
                </div>

                {links[r.id] && <LinkBox url={links[r.id]} onCopy={copyText} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
