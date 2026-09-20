"use client";

import Link from "next/link";
import { Card, Badge } from "@/components/ui/Card";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { CARD_NEWS_PAGES, getPlanById, type PlanId } from "@/lib/plans";
import {
  SubscribePanel,
  type BillingState,
} from "@/components/points/SubscribePanel";
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

/** 제공량 초과 시 건당 차감 포인트 — 관리자 화면(service_prices) 단가. */
export interface OveragePrices {
  site: number;
  blogPost: number;
  cardNews: number;
  aiImage: number;
}

export function PointsView({
  userId,
  balance,
  subscription,
  billing,
  transactions,
  payments,
  overage,
  customerName,
  customerEmail,
}: {
  userId: string;
  balance: number;
  subscription: SubscriptionInfo;
  billing: BillingState;
  transactions: PointTx[];
  payments: PaymentItem[];
  overage: OveragePrices;
  customerName: string;
  customerEmail: string;
}) {
  const ko = useLocale() === "ko";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="eyebrow mb-2">UP</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "UP 포인트" : "UP Points"}
        </h1>
      </div>

      <div className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
        <p className="text-sm opacity-85">{ko ? "보유 UP" : "Balance"}</p>
        <p className="tnum mt-1 text-4xl font-bold">
          🪙 {balance.toLocaleString()} UP
        </p>
        <p className="mt-2 text-xs opacity-75">
          {ko
            ? "UP은 활동 보상으로 쌓이며, STORYUP 서비스 이용 전용입니다 (현금·양도 불가)"
            : "UP is earned through activity rewards, and can only be spent inside STORYUP (no cash-out or transfer)"}
        </p>
        <Link
          href="/rewards"
          className="mt-3 inline-block text-xs font-semibold text-primary-foreground underline underline-offset-4 opacity-90 hover:opacity-100"
        >
          {ko ? "UP 적립 방법 보기 →" : "How to earn UP →"}
        </Link>
      </div>

      {/* 내 플랜 · 이번 달 사용량 */}
      {(() => {
        const plan = getPlanById(subscription.planId);
        // 무료 플랜의 블로그·카드뉴스는 월 갱신이 아닌 누적 총량 기준.
        const lifetime = subscription.planId === "free";
        const blogPeriod = lifetime
          ? ko
            ? "누적"
            : "total"
          : ko
            ? "이번 달"
            : "this month";
        return (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              {ko ? "내 플랜" : "My plan"}
            </h2>
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
                  label={
                    ko
                      ? `블로그 생성 (${blogPeriod})`
                      : `Blog posts (${blogPeriod})`
                  }
                  used={subscription.usage.blogPosts}
                  limit={plan.limits.blogPosts}
                  ko={ko}
                />
                <UsageRow
                  label={
                    ko
                      ? `SNS 카드뉴스 ${CARD_NEWS_PAGES}매 (${blogPeriod})`
                      : `Card news, ${CARD_NEWS_PAGES} pages (${blogPeriod})`
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
              {(() => {
                const amt = (n: number) =>
                  n > 0
                    ? `${n.toLocaleString()} UP`
                    : ko
                      ? "무료"
                      : "Free";
                const items = [
                  `${ko ? "랜딩페이지" : "Landing page"} ${amt(overage.site)}`,
                  `${ko ? "블로그" : "Blog"} ${amt(overage.blogPost)}`,
                  `${ko ? "카드뉴스" : "Card news"} ${amt(overage.cardNews)}`,
                  `${ko ? "이미지" : "Image"} ${amt(overage.aiImage)}`,
                ].join(" · ");
                return (
                  <p className="text-xs text-muted">
                    {ko
                      ? `제공량을 초과하면 건당 UP이 자동 차감됩니다. (${items})`
                      : `Past your quota, UP is deducted per item. (${items})`}
                  </p>
                );
              })()}
            </Card>
          </section>
        );
      })()}

      {/* 구독 시작/변경/해지 */}
      <SubscribePanel
        userId={userId}
        currentPlanId={subscription.planId}
        billing={billing}
        customerName={customerName}
        customerEmail={customerEmail}
      />

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
                    ₩{p.amount.toLocaleString()}
                    {p.credits > 0
                      ? ` → ${p.credits.toLocaleString()} UP`
                      : ko
                        ? " · 구독 결제"
                        : " · Subscription"}
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
                  {t.amount.toLocaleString()} UP
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
