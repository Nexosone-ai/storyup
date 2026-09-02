"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  requestWithdrawal,
  createChargeOrderAction,
  confirmChargeAction,
  markChargeFailedAction,
} from "@/app/dashboard/points/actions";
import type { PointTx, Withdrawal } from "@/lib/points";

function fmtDate(iso: string, ko: boolean) {
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

const WD_STATUS: Record<
  string,
  { ko: string; en: string; tone: "success" | "muted" | "warning" }
> = {
  pending: { ko: "대기 중", en: "Pending", tone: "warning" },
  approved: { ko: "승인됨", en: "Approved", tone: "success" },
  rejected: { ko: "반려됨", en: "Rejected", tone: "muted" },
};

const PAY_STATUS: Record<
  string,
  { ko: string; en: string; tone: "success" | "muted" | "warning" | "danger" }
> = {
  PENDING: { ko: "진행 중", en: "In progress", tone: "warning" },
  PAID: { ko: "결제 완료", en: "Paid", tone: "success" },
  FAILED: { ko: "실패", en: "Failed", tone: "muted" },
  CANCELLED: { ko: "취소됨", en: "Cancelled", tone: "danger" },
  PARTIALLY_CANCELLED: { ko: "부분 취소", en: "Partially cancelled", tone: "danger" },
  REFUNDED: { ko: "환불됨", en: "Refunded", tone: "danger" },
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
  const ko = useLocale() === "ko";
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
        setChargeError(
          order.error ??
            (ko ? "주문 생성에 실패했습니다." : "Failed to create the order."),
        );
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
        const msg =
          response?.message ??
          (ko ? "결제가 취소되었습니다." : "The payment was cancelled.");
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
        setChargeError(
          confirmed.error ??
            (ko
              ? "결제 확인에 실패했습니다."
              : "Failed to confirm the payment."),
        );
      }
    } catch {
      setChargeError(
        ko
          ? "결제 처리 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong while processing the payment. Please try again.",
      );
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
        <p className="eyebrow mb-2">{ko ? "포인트" : "Points"}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "포인트 지갑" : "Points wallet"}
        </h1>
      </div>

      <Card className="bg-primary text-primary-foreground">
        <p className="text-sm opacity-85">{ko ? "보유 포인트" : "Balance"}</p>
        <p className="tnum mt-1 text-4xl font-bold">
          {balance.toLocaleString()} P
        </p>
        <p className="mt-2 text-xs opacity-75">
          {ko
            ? `출금 가능(수익) ${withdrawable.toLocaleString()} P · 충전 크레딧은 STORYUP 서비스 이용 전용입니다`
            : `Withdrawable (earnings) ${withdrawable.toLocaleString()} P · Purchased credits are for STORYUP services only`}
        </p>
      </Card>

      {/* 충전 성공 */}
      {success && (
        <Card className="border-primary/40 bg-primary-soft">
          <p className="font-semibold text-primary">
            {ko ? "충전이 완료되었습니다 🎉" : "Top-up complete 🎉"}
          </p>
          <p className="tnum mt-1 text-sm">
            +{success.credited.toLocaleString()} P{" "}
            {ko ? "적립 · 현재 잔액" : "added · Current balance"}{" "}
            <b>{success.balance.toLocaleString()} P</b>
          </p>
        </Card>
      )}

      {/* 크레딧 충전 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {ko ? "크레딧 충전" : "Top up credits"}
        </h2>
        {packages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            {ko
              ? "판매 중인 충전 패키지가 없습니다."
              : "No credit packages available."}
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
                    {ko
                      ? `+${pkg.bonus.toLocaleString()}P 보너스 포함`
                      : `Includes +${pkg.bonus.toLocaleString()}P bonus`}
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
          {ko
            ? "충전한 크레딧은 STORYUP 내 AI 서비스 이용에만 사용할 수 있으며, 타인 양도·현금 출금·외부 거래가 불가능합니다."
            : "Purchased credits can only be used for AI services within STORYUP and cannot be transferred, withdrawn as cash, or traded externally."}{" "}
        </p>
      </section>

      {/* 결제 내역 */}
      {payments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {ko ? "결제 내역" : "Payment history"}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="tnum text-sm font-medium">
                    ₩{p.amount.toLocaleString()} →{" "}
                    {p.credits.toLocaleString()} P
                  </p>
                  <p className="text-xs text-muted">
                    {fmtDate(p.created_at, ko)}
                  </p>
                </div>
                <Badge tone={PAY_STATUS[p.status]?.tone ?? "muted"}>
                  {(ko ? PAY_STATUS[p.status]?.ko : PAY_STATUS[p.status]?.en) ??
                    p.status}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {ko ? "출금 요청" : "Withdrawal"}
        </h2>
        <p className="text-xs text-muted">
          {ko
            ? "커뮤니티·템플릿 수익 포인트만 출금할 수 있습니다. (충전 크레딧 제외)"
            : "Only earnings from community and template sales can be withdrawn. (Purchased credits excluded)"}
        </p>
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="wd-amount">
                {ko ? "출금 포인트" : "Points to withdraw"}
              </Label>
              <Input
                id="wd-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={ko ? "예: 10000" : "e.g. 10000"}
              />
            </div>
            <div>
              <Label htmlFor="wd-acc">
                {ko ? "정산 계좌" : "Payout account"}
              </Label>
              <Input
                id="wd-acc"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder={
                  ko
                    ? "은행 / 계좌번호 / 예금주"
                    : "Bank / account number / holder"
                }
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? (
              <Spinner className="size-4" />
            ) : ko ? (
              "출금 요청"
            ) : (
              "Request withdrawal"
            )}
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
                  <p className="text-xs text-muted">
                    {fmtDate(w.created_at, ko)}
                  </p>
                </div>
                <Badge tone={WD_STATUS[w.status]?.tone ?? "muted"}>
                  {(ko ? WD_STATUS[w.status]?.ko : WD_STATUS[w.status]?.en) ??
                    w.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {ko ? "거래 내역" : "Transactions"}
        </h2>
        {transactions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            {ko ? "아직 거래 내역이 없습니다." : "No transactions yet."}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.reason}</p>
                  <p className="text-xs text-muted">
                    {fmtDate(t.created_at, ko)}
                  </p>
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
