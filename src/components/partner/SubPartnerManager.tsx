"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export interface SubPartnerItem {
  subUserId: string;
  name: string | null;
  email: string | null;
  status: string;
  clientCount: number;
  /** 활동 요약(랜딩·블로그·카드뉴스·리드·30일 조회). */
  metrics?: {
    sitesPublished: number;
    blogPublished: number;
    cardNews: number;
    leads: number;
    views30d: number;
  };
}

type InviteResult = { ok?: boolean; error?: string };
type StatusResult = { ok?: boolean; error?: string };

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * 상위파트너의 서브파트너 관리 — 이메일 초대(즉시 활성) + 목록/상태 토글.
 * 초대 성공 시 revalidate로 서버가 목록을 다시 내려주므로 router.refresh만 유발한다.
 */
export function SubPartnerManager({
  initial,
  invite,
  setStatus,
}: {
  initial: SubPartnerItem[];
  invite: (email: string) => Promise<InviteResult>;
  setStatus: (
    subUserId: string,
    status: "active" | "suspended",
  ) => Promise<StatusResult>;
}) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setMsg(null);
      setError(null);
      const res = await invite(email);
      if (res.error) setError(res.error);
      else {
        setEmail("");
        setMsg("서브파트너를 등록했어요.");
      }
    });

  const toggle = (sub: SubPartnerItem) =>
    start(async () => {
      setMsg(null);
      setError(null);
      const next = sub.status === "active" ? "suspended" : "active";
      const res = await setStatus(sub.subUserId, next);
      if (res.error) setError(res.error);
    });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-semibold">서브파트너 초대</h2>
        <p className="mt-1 text-xs text-muted">
          이미 스토리업에 가입한 이메일을 입력하면 바로 서브파트너로 등록됩니다.
          서브파트너는 파트너와 동일한 기능을 쓰되, 내가 정한 가격 위에 자기
          마진을 붙여 고객에게 판매할 수 있어요.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs text-muted">
            초대할 이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 ${field}`}
              placeholder="partner@example.com"
            />
          </label>
          <Button size="sm" onClick={submit} disabled={pending || !email.trim()}>
            초대 · 등록
          </Button>
        </div>
        {msg && <p className="mt-2 text-xs text-primary">{msg}</p>}
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>

      {initial.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8">
          <p className="font-semibold">아직 등록한 서브파트너가 없습니다.</p>
          <p className="mt-1 text-sm text-muted">
            위에서 이메일로 초대하면 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {initial.map((s) => (
            <li
              key={s.subUserId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {s.name ?? s.email ?? s.subUserId}
                  {s.status !== "active" && (
                    <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted">
                      중단됨
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {s.email ?? ""} · 가입 고객 {s.clientCount}곳
                </p>
                {s.metrics && (
                  <p className="mt-1 text-xs text-muted">
                    랜딩 {s.metrics.sitesPublished} · 블로그{" "}
                    {s.metrics.blogPublished} · 카드뉴스 {s.metrics.cardNews} ·
                    리드 {s.metrics.leads} · 30일 조회 {s.metrics.views30d}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggle(s)}
                  disabled={pending}
                >
                  {s.status === "active" ? "중단" : "재개"}
                </Button>
                <Link
                  href={`/partner/sub-partners/${s.subUserId}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-primary"
                >
                  활동 보기
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
