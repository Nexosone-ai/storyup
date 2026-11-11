"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  makePartnerAction,
  assignClientAction,
  unassignClientAction,
  grantEntitlementAction,
  removePartnerAction,
  setProvisioningAction,
} from "@/app/dashboard/admin/partners/actions";
import type { PartnerAssignmentRow, PartnerListRow } from "@/lib/partner";
import type { AdminShareRow } from "@/lib/accountShare";
import {
  ENTITLEMENT_SERVICES,
  formatEntitlementSummary,
} from "@/lib/partner/entitlementCatalog";

const field =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function AdminPartnersView({
  assignments,
  accountShares = [],
  partners = [],
}: {
  assignments: PartnerAssignmentRow[];
  accountShares?: AdminShareRow[];
  partners?: PartnerListRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 폼 상태
  const [partnerEmail, setPartnerEmail] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [grantEmail, setGrantEmail] = useState("");
  const [grantService, setGrantService] = useState<string>(ENTITLEMENT_SERVICES[0].key);
  const [grantUnits, setGrantUnits] = useState(1);
  const [grantReason, setGrantReason] = useState("");
  const [list, setList] = useState(assignments);
  const [partnerList, setPartnerList] = useState(partners);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

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
          파트너 자격 부여, 대행 고객 배정, 작업권 부여를 관리합니다.
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

      {/* 1.5) 현재 파트너 목록 + 해제(삭제) */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold">
          현재 파트너 ({partnerList.length})
        </h3>
        <p className="mt-1 text-xs text-muted">
          파트너 해제 시 계정은 무료 플랜으로 돌아가고 파트너 영역 접근·고객 배정·파트너(영업)
          관계가 정리됩니다. 작업권 원장·정산 기록은 보존되며, 다시 파트너로 설정하면
          남은 작업권을 그대로 씁니다.
        </p>
        {partnerList.length === 0 ? (
          <p className="mt-3 text-sm text-muted">파트너가 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {partnerList.map((p) => (
              <li
                key={p.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{p.email ?? p.userId}</span>
                  {p.name && <span className="text-muted"> · {p.name}</span>}
                  {p.isSub && (
                    <span className="ml-1 rounded-full border border-border px-1.5 py-0.5 text-[11px] text-muted">
                      영업
                    </span>
                  )}
                  {p.provisioning && (
                    <span className="ml-1 rounded-full border border-primary/40 px-1.5 py-0.5 text-[11px] text-primary">
                      별도계약·계정생성
                    </span>
                  )}
                  <span className="ml-2 text-xs text-muted tabular-nums">
                    작업권 {formatEntitlementSummary(p.entitlements)} · 고객 {p.clientCount}
                  </span>
                </span>
                {confirmRemove === p.userId ? (
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-danger">정말 해제할까요?</span>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        run(async () => {
                          const res = await removePartnerAction(p.userId);
                          if (res.ok) {
                            setPartnerList((l) => l.filter((x) => x.userId !== p.userId));
                            setList((l) => l.filter((a) => a.partnerEmail !== p.email));
                          }
                          setConfirmRemove(null);
                          return res;
                        })
                      }
                      disabled={pending}
                    >
                      해제
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                      취소
                    </Button>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    {!p.isSub && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          run(async () => {
                            const next = !p.provisioning;
                            const res = await setProvisioningAction(p.userId, next);
                            if (res.ok)
                              setPartnerList((l) =>
                                l.map((x) => (x.userId === p.userId ? { ...x, provisioning: next } : x)),
                              );
                            return res;
                          })
                        }
                        disabled={pending}
                        title="별도계약 파트너: 고객 계정을 직접 생성(Lite 30일 · Lite 계정 작업권 1개 사용)할 수 있게 합니다. 서브파트너도 상속."
                      >
                        {p.provisioning ? "계정생성 끄기" : "계정생성 켜기"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmRemove(p.userId)}
                      disabled={pending}
                    >
                      파트너 해제
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
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

      {/* 3) 작업권 부여 */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold">3. 작업권 부여</h3>
        <p className="mt-1 text-xs text-muted">
          평소에는 고객이 파트너 상품을 결제하면 상품에 포함된 작업권이 자동으로 지급됩니다.
          계약 선지급·오류 보정·테스트처럼 결제 없이 줄 때만 여기서 직접 부여하세요. 음수를 넣으면 차감(보정)됩니다.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input
            type="email"
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            placeholder="파트너 이메일"
            className={field}
          />
          <select
            value={grantService}
            onChange={(e) => setGrantService(e.target.value)}
            className={field}
          >
            {ENTITLEMENT_SERVICES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label} ({s.unitLabel})
              </option>
            ))}
          </select>
          <input
            type="number"
            value={grantUnits}
            onChange={(e) => setGrantUnits(Number(e.target.value))}
            className={field}
          />
          <input
            type="text"
            value={grantReason}
            onChange={(e) => setGrantReason(e.target.value)}
            placeholder="사유(필수) 예: 계약 선지급"
            className={field}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            className="ml-auto"
            onClick={() =>
              run(() =>
                grantEntitlementAction(grantEmail, grantService, grantUnits, grantReason),
              )
            }
            disabled={
              pending ||
              !grantEmail.trim() ||
              !grantReason.trim() ||
              !Number.isInteger(grantUnits) ||
              grantUnits === 0
            }
          >
            작업권 부여
          </Button>
        </div>
      </section>

    </div>
  );
}
