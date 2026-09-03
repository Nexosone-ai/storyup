"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { CARD_NEWS_PAGES, getPlanById, type PlanId } from "@/lib/plans";
import {
  createChargeOrderAction,
  confirmChargeAction,
  markChargeFailedAction,
} from "@/app/dashboard/points/actions";
import type { PointTx } from "@/lib/points";

function fmtDate(iso: string, ko: boolean) {
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

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

export interface SubscriptionInfo {
  planId: PlanId;
  usage: { blogPosts: number; cardNews: number; aiImages: number };
  sites: number;
}

function UsageRow({
  label,
  used,
  limit,
  ko,
  unlimitedLabel,
}: {
  label: string;
  used: number;
  limit: number | null;
  ko: boolean;
  unlimitedLabel?: string;
}) {
  const pct =
    limit === null || limit === 0
      ? 0
      : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="tnum text-muted">
          {limit === null
            ? (unlimitedLabel ?? (ko ? "협의" : "Custom"))
            : limit === 0
              ? ko
                ? "무료 모델 전용"
                : "Free model only"
              : `${used.toLocaleString()} / ${limit.toLocaleString()}`}
        </span>
      </div>
      {limit !== null && limit > 0 && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div
            className={`h-full rounded-full ${pct >= 100 ? "bg-danger" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function PointsView({
  balance,
  subscription,
  transactions,
  packages,
  payments,
}: {
  balance: number;
  subscription: SubscriptionInfo;
  transactions: PointTx[];
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
        // KG이니시스 PC 결제창 필수: 이름·전화번호·이메일 (전화번호 미보유 시 대체값)
        customer: {
          fullName: order.customerName ?? (ko ? "고객" : "Customer"),
          email: order.customerEmail,
          phoneNumber: order.customerPhone ?? "01000000000",
        },
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
    } catch (err) {
      console.error("[charge]", err);
      const detail =
        err instanceof Error && err.message ? ` (${err.message})` : "";
      setChargeError(
        (ko
          ? "결제 처리 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong while processing the payment. Please try again.") +
          detail,
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

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="eyebrow mb-2">{ko ? "포인트" : "Points"}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "포인트 지갑" : "Points wallet"}
        </h1>
      </div>

      <div className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
        <p className="text-sm opacity-85">{ko ? "보유 포인트" : "Balance"}</p>
        <p className="tnum mt-1 text-4xl font-bold">
          {balance.toLocaleString()} P
        </p>
        <p className="mt-2 text-xs opacity-75">
          {ko
            ? "충전 크레딧은 STORYUP 서비스 이용 전용입니다"
            : "Purchased credits are for STORYUP services only"}
        </p>
      </div>

      {/* 내 플랜 · 이번 달 사용량 */}
      {(() => {
        const plan = getPlanById(subscription.planId);
        return (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">
                {ko ? "내 플랜" : "My plan"}
              </h2>
              <Link
                href="/pricing"
                target="_blank"
                className="text-sm font-medium text-primary hover:underline"
              >
                {ko ? "플랜 업그레이드 →" : "Upgrade plan →"}
              </Link>
            </div>
            <Card className="space-y-4">
              <div className="flex items-baseline justify-between">
                <p className="text-base font-bold uppercase tracking-[0.1em]">
                  {plan.name[ko ? "ko" : "en"]}
                </p>
                <p className="tnum text-sm text-muted">
                  {plan.priceKrw === null
                    ? ko
                      ? "별도 협의"
                      : "Custom"
                    : plan.priceKrw === 0
                      ? ko
                        ? "무료"
                        : "Free"
                      : `₩${plan.priceKrw.toLocaleString()}${ko ? "/월" : "/mo"}`}
                  {plan.monthlyPoints !== null && (
                    <>
                      {" · "}
                      {ko
                        ? `매월 ${plan.monthlyPoints.toLocaleString()}P`
                        : `${plan.monthlyPoints.toLocaleString()}P/mo`}
                    </>
                  )}
                </p>
              </div>
              <div className="space-y-3">
                <UsageRow
                  label={ko ? "AI 랜딩페이지 (보유)" : "AI landing pages (owned)"}
                  used={subscription.sites}
                  limit={plan.limits.sites}
                  ko={ko}
                />
                <UsageRow
                  label={ko ? "블로그 생성 (이번 달)" : "Blog posts (this month)"}
                  used={subscription.usage.blogPosts}
                  limit={plan.limits.blogPosts}
                  ko={ko}
                />
                <UsageRow
                  label={
                    ko
                      ? `SNS 카드뉴스 ${CARD_NEWS_PAGES}매 (이번 달)`
                      : `Card news, ${CARD_NEWS_PAGES} pages (this month)`
                  }
                  used={subscription.usage.cardNews}
                  limit={plan.limits.cardNews}
                  ko={ko}
                />
                <UsageRow
                  label={ko ? "AI 이미지 (이번 달)" : "AI images (this month)"}
                  used={subscription.usage.aiImages}
                  limit={plan.limits.aiImages}
                  ko={ko}
                  unlimitedLabel={ko ? "협의" : "Custom"}
                />
              </div>
              <p className="text-xs text-muted">
                {ko
                  ? "제공량을 초과하면 건당 포인트가 자동 차감됩니다. (랜딩페이지 3,000P · 블로그 1,000P · 카드뉴스 1,000P · 이미지 100P)"
                  : "Past your quota, points are deducted per item. (Landing page 3,000P · Blog 1,000P · Card news 1,000P · Image 100P)"}
              </p>
            </Card>
          </section>
        );
      })()}

      {/* 충전 성공 */}
      {success && (
        <div className="rounded-2xl border border-primary/40 bg-primary-soft p-6">
          <p className="font-semibold text-primary">
            {ko ? "충전이 완료되었습니다 🎉" : "Top-up complete 🎉"}
          </p>
          <p className="tnum mt-1 text-sm">
            +{success.credited.toLocaleString()} P{" "}
            {ko ? "적립 · 현재 잔액" : "added · Current balance"}{" "}
            <b>{success.balance.toLocaleString()} P</b>
          </p>
        </div>
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
