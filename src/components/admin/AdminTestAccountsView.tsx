"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  createTestAccountAction,
  extendTestAccountAction,
  deleteTestAccountAction,
  resetTestAccountPasswordAction,
} from "@/app/dashboard/admin/test-accounts/actions";

export interface TestAccountRow {
  id: string;
  email: string | null;
  label: string | null;
  password: string | null;
  expiresAt: string | null;
  createdAt: string;
  expired: boolean;
}

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export function AdminTestAccountsView({ rows }: { rows: TestAccountRow[] }) {
  const [list, setList] = useState(rows);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(30);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [resetPw, setResetPw] = useState<Record<string, string>>({});

  const copyText = (t: string) => {
    navigator.clipboard?.writeText(t).catch(() => {});
    setMsg("복사했어요.");
  };

  const doReset = (id: string) => {
    const pw = (resetPw[id] ?? "").trim();
    if (pw.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    setBusyId(id);
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await resetTestAccountPasswordAction(id, pw);
      if (res.error) setError(res.error);
      else {
        setMsg(res.message ?? "비밀번호를 변경했어요.");
        setList((l) => l.map((r) => (r.id === id ? { ...r, password: pw } : r)));
        setResetPw((m) => ({ ...m, [id]: "" }));
        setShown((m) => ({ ...m, [id]: true }));
      }
      setBusyId(null);
    });
  };

  const create = () => {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await createTestAccountAction({ email, password, days, label });
      if (res.error) {
        setError(res.error);
        return;
      }
      setMsg(res.message ?? "생성됐어요.");
      setEmail("");
      setPassword("");
      setLabel("");
      // 새 항목을 목록 맨 위에 낙관적으로 추가(정확한 값은 새로고침 시 반영).
      setList((l) => [
        {
          id: `tmp-${Date.now()}`,
          email: email.trim().toLowerCase(),
          label: label.trim() || null,
          password: password.trim() || null,
          expiresAt: new Date(
            Date.now() + days * 86400000,
          ).toISOString(),
          createdAt: new Date().toISOString(),
          expired: false,
        },
        ...l,
      ]);
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
          영업자에게 줄 테스트 계정을 만듭니다. 아이디(이메일)·비밀번호를 지정하고
          Pro 플랜으로 설정하며, 사용 기간이 끝나면 자동으로 일반(무료)로 전환됩니다.
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
            <span className="mb-1 block font-medium text-muted">비밀번호</span>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8자 이상"
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

                {!temp && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">
                    {/* 비밀번호 보기 */}
                    <span className="text-muted">비밀번호</span>
                    {r.password ? (
                      <>
                        <code className="rounded bg-surface-muted px-2 py-1 font-mono text-foreground">
                          {shown[r.id] ? r.password : "•".repeat(10)}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            setShown((m) => ({ ...m, [r.id]: !m[r.id] }))
                          }
                          className="text-muted underline-offset-2 hover:text-primary hover:underline"
                        >
                          {shown[r.id] ? "숨기기" : "보기"}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText(r.password as string)}
                          className="text-muted underline-offset-2 hover:text-primary hover:underline"
                        >
                          복사
                        </button>
                      </>
                    ) : (
                      <span className="text-muted">
                        저장된 비번 없음 — 아래에서 재설정하세요
                      </span>
                    )}
                    {/* 비밀번호 재설정 */}
                    <span className="ml-auto flex items-center gap-1.5">
                      <input
                        type="text"
                        value={resetPw[r.id] ?? ""}
                        onChange={(e) =>
                          setResetPw((m) => ({ ...m, [r.id]: e.target.value }))
                        }
                        placeholder="새 비밀번호(8자+)"
                        className="w-40 rounded-lg border border-border bg-background px-2 py-1.5 outline-none focus:border-primary"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => doReset(r.id)}
                        disabled={pending && busyId === r.id}
                      >
                        변경
                      </Button>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
