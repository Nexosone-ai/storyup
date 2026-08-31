"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  requestWithdrawal,
  createChargeOrderAction,
  confirmChargeAction,
  markChargeFailedAction,
} from "@/app/dashboard/points/actions";
import type { PointTx, Withdrawal } from "@/lib/points";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

const WD_STATUS: Record<
  string,
  { label: string; tone: "success" | "muted" | "warning" }
> = {
  pending: { label: "대기 중", tone: "warning" },
  approved: { label: "승인됨", tone: "success" },
  rejected: { label: "반려됨", tone: "muted" },
};

const PAY_STATUS: Record<
  string,
  { label: string; tone: "success" | "muted" | "warning" | "danger" }
> = {
  PENDING: { label: "진행 중", tone: "warning" },
  PAID: { label: "결제 완료", tone: "success" },
  FAILED: { label: "실패", tone: "muted" },
  CANCELLED: { label: "취소됨", tone: "danger" },
  PARTIALLY_CANCELLED: { label: "부분 취소", tone: "danger" },
  REFUNDED: { label: "환불됨", tone: "danger" },
};

export interface ChargePackage {
  id: string;
  name: string;
  price: number;
  credits: number;
  bonus: number;
}

export interface PaymentItem {
  id: string;
  orderId: string;
  amount: number;
  credits: number;
  status: string;
  created_at: string;
}

export function PointsView({
  balance,
  withdrawable,
  transactions,
  withdrawals,
  packages,
  payments,
}: {
  balance: number;
  withdrawable: number;
  transactions: PointTx[];
  withdrawals: Withdrawal[];
  packages: ChargePackage[];
  payments: PaymentItem[];
}) {
  const router = useRouter();

  // ---- 충전 ----
  const [charging, setCharging] = useState<string | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    credited: number;
    balance: number;
  } | null>(null);

  const charge = async (pkg: ChargePackage) => {
    setChargeError(null);
    setSuccess(null);
    setCharging(pkg.id);
    try {
      const order = await createChargeOrderAction(pkg.id);
      if (order.error || !order.orderId) {
        setChargeError(order.error ?? "주문 생성에 실패했습니다.");
        return;
      }

      const PortOne = await import("@portone/browser-sdk/v2");
      const response = await PortOne.requestPayment({
        storeId: order.storeId!,
        channelKey: order.channelKey!,
        paymentId: order.orderId,
        orderName: order.orderName!,
        totalAmount: order.amount!,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: order.customerEmail
          ? { email: order.customerEmail }
          : undefined,
        redirectUrl: `${window.location.origin}/dashboard/points`,
      });

      if (!response || response.code !== undefined) {
        const msg = response?.message ?? "결제가 취소되었습니다.";
        await markChargeFailedAction(order.orderId, msg);
        setChargeError(msg);
        return;
      }

      // 서버 측 검증 후에만 적립된다.
      const confirmed = await confirmChargeAction(order.orderId);
      if (confirmed.ok) {
        setSuccess({
          credited: confirmed.credited ?? 0,
          balance: confirmed.balance ?? balance,
        });
        router.refresh();
      } else {
        setChargeError(confirmed.error ?? "결제 확인에 실패했습니다.");
      }
    } catch {
      setChargeError("결제 처리 중 문제가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setCharging(null);
    }
  };

  // 모바일 리다이렉트 복귀 처리: ?paymentId=su_... 로 돌아오면 서버 검증 실행
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("paymentId");
    if (!paymentId?.startsWith("su_")) return;
    window.history.replaceState({}, "", window.location.pathname);
    (async () => {
      const confirmed = await confirmChargeAction(paymentId);
      if (confirmed.ok) {
        setSuccess({
          credited: confirmed.credited ?? 0,
          balance: confirmed.balance ?? 0,
        });
      } else if (confirmed.error) {
        setChargeError(confirmed.error);
      }
      router.refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 출금 ----
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await requestWithdrawal(Number(amount), account);
      if (res.error) setError(res.error);
      else {
        setAmount("");
        setAccount("");
        router.refresh();
      }
    });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="eyebrow mb-2">포인트</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          포인트 지갑
        </h1>
      </div>

      <Card className="bg-primary text-primary-foreground">
        <p className="text-sm opacity-85">보유 포인트</p>
        <p className="tnum mt-1 text-4xl font-bold">
          {balance.toLocaleString()} P
        </p>
        <p className="mt-2 text-xs opacity-75">
          출금 가능(수익) {withdrawable.toLocaleString()} P · 충전 크레딧은
          STORYUP 서비스 이용 전용입니다
        </p>
      </Card>

      {/* 충전 성공 */}
      {success && (
        <Card className="border-primary/40 bg-primary-soft">
          <p className="font-semibold text-primary">충전이 완료되었습니다 🎉</p>
          <p className="tnum mt-1 text-sm">
            +{success.credited.toLocaleString()} P 적립 · 현재 잔액{" "}
            <b>{success.balance.toLocaleString()} P</b>
          </p>
        </Card>
      )}

      {/* 크레딧 충전 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">크레딧 충전</h2>
        {packages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            판매 중인 충전 패키지가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => charge(pkg)}
                disabled={charging !== null}
                className="rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-primary/60 hover:bg-surface-muted disabled:opacity-60"
              >
                <p className="text-xs font-medium text-muted">{pkg.name}</p>
                <p className="tnum mt-1 text-lg font-bold">
                  {(pkg.credits + pkg.bonus).toLocaleString()} P
                </p>
                {pkg.bonus > 0 && (
                  <p className="text-xs text-primary">
                    +{pkg.bonus.toLocaleString()}P 보너스 포함
                  </p>
                )}
                <p className="tnum mt-2 text-sm text-muted">
                  ₩{pkg.price.toLocaleString()}
                </p>
                {charging === pkg.id && <Spinner className="mt-2 size-4" />}
              </button>
            ))}
          </div>
        )}
        {chargeError && <p className="text-sm text-danger">{chargeError}</p>}
        <p className="text-xs text-muted">
          충전한 크레딧은 STORYUP 내 AI 서비스 이용에만 사용할 수 있으며, 타인
          양도·현금 출금·외부 거래가 불가능합니다.{" "}
        </p>
      </section>

      {/* 결제 내역 */}
      {payments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">결제 내역</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="tnum text-sm font-medium">
                    ₩{p.amount.toLocaleString()} →{" "}
                    {p.credits.toLocaleString()} P
                  </p>
                  <p className="text-xs text-muted">{fmtDate(p.created_at)}</p>
                </div>
                <Badge tone={PAY_STATUS[p.status]?.tone ?? "muted"}>
                  {PAY_STATUS[p.status]?.label ?? p.status}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">출금 요청</h2>
        <p className="text-xs text-muted">
          커뮤니티·템플릿 수익 포인트만 출금할 수 있습니다. (충전 크레딧 제외)
        </p>
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="wd-amount">출금 포인트</Label>
              <Input
                id="wd-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="예: 10000"
              />
            </div>
            <div>
              <Label htmlFor="wd-acc">정산 계좌</Label>
              <Input
                id="wd-acc"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="은행 / 계좌번호 / 예금주"
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? <Spinner className="size-4" /> : "출금 요청"}
          </Button>
        </Card>

        {withdrawals.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {withdrawals.map((w) => (
              <li key={w.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="tnum font-medium">
                    {w.amount.toLocaleString()} P
                  </p>
                  <p className="text-xs text-muted">{fmtDate(w.created_at)}</p>
                </div>
                <Badge tone={WD_STATUS[w.status]?.tone ?? "muted"}>
                  {WD_STATUS[w.status]?.label ?? w.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">거래 내역</h2>
        {transactions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            아직 거래 내역이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.reason}</p>
                  <p className="text-xs text-muted">{fmtDate(t.created_at)}</p>
                </div>
                <span
                  className={`tnum font-semibold ${t.amount >= 0 ? "text-primary" : "text-danger"}`}
                >
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount.toLocaleString()} P
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
