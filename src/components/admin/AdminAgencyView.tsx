"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  setSupplyPriceAction,
  assignInquiryAction,
  markEarningPaidAction,
  reviewSupporterAction,
} from "@/app/dashboard/admin/agency/actions";

interface SupplyRow {
  key: string;
  label: string;
  supplyPriceKrw: number;
  active: boolean;
}
interface InquiryRow {
  id: string;
  serviceLabel: string;
  status: string;
  createdAt: string;
}
interface EarningRow {
  id: string;
  partnerEmail: string | null;
  amountKrw: number;
  createdAt: string;
}
interface SupporterPending {
  id: string;
  displayName: string;
  email: string | null;
  workStatus: string | null;
  history: string | null;
  portfolioUrl: string | null;
}

/** 입금 확인(결제 완료) 기준 2주 내 정산 — 정산 기한. */
function dueDate(createdAt: string): string {
  return new Date(new Date(createdAt).getTime() + 14 * 86400000).toLocaleDateString(
    "ko-KR",
  );
}

const field =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function AdminAgencyView({
  services,
  inquiries,
  earnings,
  pendingSupporters,
}: {
  services: SupplyRow[];
  inquiries: InquiryRow[];
  earnings: EarningRow[];
  pendingSupporters: SupporterPending[];
}) {
  const [prices, setPrices] = useState(services);
  const [inqList, setInqList] = useState(inquiries);
  const [earnList, setEarnList] = useState(earnings);
  const [supporters, setSupporters] = useState(pendingSupporters);
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) =>
    start(async () => {
      setMsg(null);
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else setMsg(res.message ?? "완료했어요.");
    });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">대행 마켓 관리</h2>
        <p className="mt-1 text-sm text-muted">
          서비스 공급가, 미배정 문의 파트너 배정, 파트너 마진 정산을 관리합니다.
        </p>
      </div>
      {(msg || error) && (
        <p className={`text-sm ${error ? "text-danger" : "text-primary"}`}>
          {error ?? msg}
        </p>
      )}

      {/* 0) 서포터즈 승인 */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold">
          서포터즈 신청 승인 ({supporters.length})
        </h3>
        {supporters.length === 0 ? (
          <p className="mt-2 text-sm text-muted">승인 대기 중인 신청이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {supporters.map((s) => (
              <li key={s.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <span className="font-medium">{s.displayName}</span>
                    {s.email && <span className="ml-2 text-xs text-muted">{s.email}</span>}
                    {s.workStatus && (
                      <span className="ml-2 text-xs text-primary">{s.workStatus}</span>
                    )}
                  </div>
                  <span className="flex gap-1.5">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const res = await reviewSupporterAction(s.id, true);
                          if (res.ok) setSupporters((l) => l.filter((x) => x.id !== s.id));
                          return res;
                        })
                      }
                    >
                      승인
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const res = await reviewSupporterAction(s.id, false);
                          if (res.ok) setSupporters((l) => l.filter((x) => x.id !== s.id));
                          return res;
                        })
                      }
                    >
                      반려
                    </Button>
                  </span>
                </div>
                {s.history && (
                  <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted">{s.history}</p>
                )}
                {s.portfolioUrl && (
                  <a
                    href={s.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-primary underline underline-offset-2"
                  >
                    포트폴리오
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 1) 공급가 */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold">1. 서비스 공급가(원)</h3>
        <ul className="mt-3 space-y-2">
          {prices.map((p, i) => (
            <li key={p.key} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
              <input
                type="number"
                min={0}
                step={10000}
                value={p.supplyPriceKrw}
                onChange={(e) =>
                  setPrices((s) =>
                    s.map((x, j) =>
                      j === i ? { ...x, supplyPriceKrw: Number(e.target.value) } : x,
                    ),
                  )
                }
                className={`${field} w-32`}
              />
              <label className="flex items-center gap-1 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={(e) =>
                    setPrices((s) =>
                      s.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)),
                    )
                  }
                />
                노출
              </label>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => setSupplyPriceAction(p.key, p.supplyPriceKrw, p.active))}
              >
                저장
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {/* 2) 미배정 문의 */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold">2. 미배정 대행 문의 ({inqList.length})</h3>
        {inqList.length === 0 ? (
          <p className="mt-2 text-sm text-muted">배정 대기 중인 문의가 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {inqList.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{i.serviceLabel}</span>
                <input
                  type="email"
                  placeholder="파트너 이메일"
                  value={assign[i.id] ?? ""}
                  onChange={(e) => setAssign((m) => ({ ...m, [i.id]: e.target.value }))}
                  className={`${field} w-48`}
                />
                <Button
                  size="sm"
                  disabled={pending || !(assign[i.id] ?? "").trim()}
                  onClick={() =>
                    run(async () => {
                      const res = await assignInquiryAction(i.id, assign[i.id] ?? "");
                      if (res.ok) setInqList((l) => l.filter((x) => x.id !== i.id));
                      return res;
                    })
                  }
                >
                  배정
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3) 정산 대기 */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold">3. 파트너 마진 정산 ({earnList.length})</h3>
        <p className="mt-1 text-xs text-muted">
          고객 구매 확정·입금 확인 후 <strong>2주 이내</strong> 지급(기한 표시).
        </p>
        {earnList.length === 0 ? (
          <p className="mt-2 text-sm text-muted">정산 대기 중인 수익이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {earnList.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {e.partnerEmail ?? "?"} ·{" "}
                  <strong>{e.amountKrw.toLocaleString()}원</strong>
                  <span className="ml-2 text-xs text-muted">
                    정산기한 {dueDate(e.createdAt)}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const res = await markEarningPaidAction(e.id);
                      if (res.ok) setEarnList((l) => l.filter((x) => x.id !== e.id));
                      return res;
                    })
                  }
                >
                  지급 완료
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
