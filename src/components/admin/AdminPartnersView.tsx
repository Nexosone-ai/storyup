"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  makePartnerAction,
  assignClientAction,
  unassignClientAction,
  grantCreditsAction,
  setCreditPriceAction,
  confirmPacketTransferAction,
  cancelPacketOrderAction,
} from "@/app/dashboard/admin/partners/actions";
import type { AdminPacketOrderRow } from "@/lib/partner/packets";
import type { PartnerAssignmentRow } from "@/lib/partner";
import type { AdminShareRow } from "@/lib/accountShare";

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
  accountShares = [],
  packetOrders = [],
}: {
  assignments: PartnerAssignmentRow[];
  prices: CreditPriceRow[];
  accountShares?: AdminShareRow[];
  packetOrders?: AdminPacketOrderRow[];
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
  const [packetNote, setPacketNote] = useState<Record<string, string>>({});
  const waitingPackets = packetOrders.filter(
    (o) => o.method === "transfer" && o.status === "pending",
  );
  const [priceState, setPriceState] = useState(prices);

  const run = (
    fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>,
  ) =>
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

      {/* 계정 공유 현황(소유자가 직접 초대한 파트너 위임 접근) */}
      {accountShares.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <h3 className="text-sm font-semibold">
            계정 공유 현황 (소유자 → 파트너)
          </h3>
          <p className="mt-1 text-xs text-muted">
            고객(소유자)이 직접 파트너를 초대해 사업장 작업 권한을 위임한
            현황입니다. (파트너 배정과 별개)
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-1.5 pr-3">소유자</th>
                  <th className="py-1.5 pr-3">파트너</th>
                  <th className="py-1.5">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accountShares.map((s) => (
                  <tr key={s.id}>
                    <td className="py-1.5 pr-3">
                      {s.ownerName || s.ownerEmail || "—"}
                    </td>
                    <td className="py-1.5 pr-3">
                      {s.partnerName || s.partnerEmail}
                    </td>
                    <td className="py-1.5">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          s.status === "accepted"
                            ? "border-success/40 text-success"
                            : "border-border text-muted"
                        }`}
                      >
                        {s.status === "accepted" ? "접근중" : "수락 대기"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
          파트너가 운영할 고객(사업주) 계정을 배정합니다. 한 파트너에 여러 고객
          가능.
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
                      if (res.ok)
                        setList((l) => l.filter((x) => x.id !== a.id));
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

      {/* 2.5) 파트너 패킷 구매 주문 — 계좌이체 입금 확인(수동 지급) + 전체 내역 */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold">
          패킷 구매 주문 · 입금 확인
          {waitingPackets.length > 0 && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              대기 {waitingPackets.length}
            </span>
          )}
        </h3>
        <p className="mt-1 text-xs text-muted">
          파트너가 발행한 계좌이체 청구서입니다. 통장 입금(입금자명·금액)을
          확인한 뒤 &lsquo;입금 확인·지급&rsquo;을 누르면 패킷이
          지급됩니다(1회만 반영, 되돌릴 수 없음). 카드결제 주문은 결제 즉시 자동
          지급됩니다.
        </p>
        {packetOrders.length === 0 ? (
          <p className="mt-3 text-sm text-muted">주문이 없습니다.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-1.5 pr-3">일자</th>
                  <th className="py-1.5 pr-3">파트너</th>
                  <th className="py-1.5 pr-3">번호 / 입금자명</th>
                  <th className="py-1.5 pr-3 text-right">패킷</th>
                  <th className="py-1.5 pr-3 text-right">입금액</th>
                  <th className="py-1.5 pr-3">상태</th>
                  <th className="py-1.5">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {packetOrders.map((o) => {
                  const waiting =
                    o.method === "transfer" && o.status === "pending";
                  return (
                    <tr key={o.id} className={waiting ? "bg-primary/5" : ""}>
                      <td className="py-2 pr-3 text-xs tabular-nums">
                        {o.created_at.slice(0, 10)}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="max-w-[180px] truncate">
                          {o.partnerEmail ?? o.partner_user_id}
                        </div>
                        {o.partnerName && (
                          <div className="text-xs text-muted">
                            {o.partnerName}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-mono text-xs">
                          {o.invoice_no ?? o.order_id?.slice(0, 16) ?? "—"}
                        </div>
                        <div className="text-xs text-muted">
                          {o.method === "card"
                            ? "카드"
                            : `입금자 ${o.depositor_name ?? "—"}`}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {o.packets.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {o.total_krw.toLocaleString()}원
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            o.status === "paid"
                              ? "border-success/40 text-success"
                              : o.status === "cancelled"
                                ? "border-border text-muted"
                                : "border-primary/40 text-primary"
                          }`}
                        >
                          {o.status === "paid"
                            ? "지급 완료"
                            : o.status === "cancelled"
                              ? "취소"
                              : o.method === "card"
                                ? "결제 대기"
                                : "입금 대기"}
                        </span>
                        {o.admin_note && (
                          <div className="mt-0.5 max-w-[160px] truncate text-[11px] text-muted">
                            {o.admin_note}
                          </div>
                        )}
                      </td>
                      <td className="py-2">
                        {waiting ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={packetNote[o.id] ?? ""}
                              onChange={(e) =>
                                setPacketNote((s) => ({
                                  ...s,
                                  [o.id]: e.target.value,
                                }))
                              }
                              placeholder="메모"
                              className={`${field} h-8 w-24 py-0 text-xs`}
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                run(() =>
                                  confirmPacketTransferAction(
                                    o.id,
                                    packetNote[o.id] ?? "",
                                  ),
                                )
                              }
                              disabled={pending}
                            >
                              입금 확인·지급
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                run(() =>
                                  cancelPacketOrderAction(
                                    o.id,
                                    packetNote[o.id] ?? "",
                                  ),
                                )
                              }
                              disabled={pending}
                            >
                              취소
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">
                            {o.granted_at
                              ? `지급 ${o.granted_at.slice(0, 10)}`
                              : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              run(() => grantCreditsAction(grantEmail, grantAmount, grantMemo))
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
                  run(() => setCreditPriceAction(p.action, p.credits, p.active))
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
