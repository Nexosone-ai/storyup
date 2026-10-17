"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  makePartnerAction,
  assignClientAction,
  unassignClientAction,
  grantCreditsAction,
  setCreditPriceAction,
} from "@/app/dashboard/admin/partners/actions";
import type { PartnerAssignmentRow } from "@/lib/partner";

export interface CreditPriceRow {
  action: string;
  label: string;
  credits: number;
  active: boolean;
}

const field =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function AdminPartnersView({
  assignments,
  prices,
}: {
  assignments: PartnerAssignmentRow[];
  prices: CreditPriceRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 폼 상태
  const [partnerEmail, setPartnerEmail] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [grantEmail, setGrantEmail] = useState("");
  const [grantAmount, setGrantAmount] = useState(1000);
  const [grantMemo, setGrantMemo] = useState("");
  const [list, setList] = useState(assignments);
  const [priceState, setPriceState] = useState(prices);

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      setMsg(null);
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else setMsg(res.message ?? "완료했어요.");
    });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">파트너 관리</h2>
        <p className="mt-1 text-sm text-muted">
          파트너 자격 부여, 대행 고객 배정, 패킷(크레딧) 지급을 관리합니다.
        </p>
      </div>

      {(msg || error) && (
        <p className={`text-sm ${error ? "text-danger" : "text-primary"}`}>
          {error ?? msg}
        </p>
      )}

      {/* 1) 파트너 자격 부여 */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold">1. 파트너 자격 부여</h3>
        <p className="mt-1 text-xs text-muted">
          해당 이메일 계정을 파트너 플랜으로 설정합니다(= 파트너 자격).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="email"
            value={partnerEmail}
            onChange={(e) => setPartnerEmail(e.target.value)}
            placeholder="partner@example.com"
            className={`${field} flex-1`}
          />
          <Button
            onClick={() => run(() => makePartnerAction(partnerEmail))}
            disabled={pending || !partnerEmail.trim()}
          >
            파트너로 설정
          </Button>
        </div>
      </section>

      {/* 2) 대행 고객 배정 */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold">2. 대행 고객 배정</h3>
        <p className="mt-1 text-xs text-muted">
          파트너가 운영할 고객(사업주) 계정을 배정합니다. 한 파트너에 여러 고객 가능.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            type="email"
            value={partnerEmail}
            onChange={(e) => setPartnerEmail(e.target.value)}
            placeholder="파트너 이메일"
            className={field}
          />
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="고객(사업주) 이메일"
            className={field}
          />
        </div>
        <div className="mt-3">
          <Button
            onClick={() =>
              run(async () => {
                const res = await assignClientAction(partnerEmail, clientEmail);
                if (res.ok) setClientEmail("");
                return res;
              })
            }
            disabled={pending || !partnerEmail.trim() || !clientEmail.trim()}
          >
            배정
          </Button>
        </div>

        {list.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm">
            {list.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{a.partnerEmail ?? "?"}</span>
                  <span className="text-muted"> → {a.clientEmail ?? "?"}</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    run(async () => {
                      const res = await unassignClientAction(a.id);
                      if (res.ok) setList((l) => l.filter((x) => x.id !== a.id));
                      return res;
                    })
                  }
                  disabled={pending}
                >
                  해제
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3) 패킷(크레딧) 지급 */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold">3. 패킷(크레딧) 지급</h3>
        <p className="mt-1 text-xs text-muted">
          계약·충전 시 파트너에게 크레딧을 지급합니다. 팩: 300 / 1,000 / 3,000.
          음수로 차감도 가능.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            type="email"
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            placeholder="파트너 이메일"
            className={field}
          />
          <input
            type="number"
            value={grantAmount}
            onChange={(e) => setGrantAmount(Number(e.target.value))}
            className={field}
          />
          <input
            type="text"
            value={grantMemo}
            onChange={(e) => setGrantMemo(e.target.value)}
            placeholder="메모(선택)"
            className={field}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {[300, 1000, 3000].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setGrantAmount(n)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-primary hover:text-primary"
            >
              {n.toLocaleString()}
            </button>
          ))}
          <Button
            className="ml-auto"
            onClick={() =>
              run(() =>
                grantCreditsAction(grantEmail, grantAmount, grantMemo),
              )
            }
            disabled={pending || !grantEmail.trim()}
          >
            지급
          </Button>
        </div>
      </section>

      {/* 4) 작업별 크레딧 단가 */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold">4. 작업별 크레딧 단가</h3>
        <p className="mt-1 text-xs text-muted">
          에이전트 작업 1건당 차감될 크레딧. 0 = 무료.
        </p>
        <ul className="mt-3 space-y-2">
          {priceState.map((p, i) => (
            <li
              key={p.action}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {p.label}{" "}
                <code className="text-xs text-muted">({p.action})</code>
              </span>
              <input
                type="number"
                min={0}
                value={p.credits}
                onChange={(e) =>
                  setPriceState((s) =>
                    s.map((x, j) =>
                      j === i ? { ...x, credits: Number(e.target.value) } : x,
                    ),
                  )
                }
                className={`${field} w-24`}
              />
              <label className="flex items-center gap-1 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={(e) =>
                    setPriceState((s) =>
                      s.map((x, j) =>
                        j === i ? { ...x, active: e.target.checked } : x,
                      ),
                    )
                  }
                />
                사용
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  run(() =>
                    setCreditPriceAction(p.action, p.credits, p.active),
                  )
                }
                disabled={pending}
              >
                저장
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
