"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { PLANS, planFeatureList, type Plan, type PlanId } from "@/lib/plans";
import { COMPANY } from "@/lib/company";
import {
  SubscribePanel,
  type BillingState,
} from "@/components/points/SubscribePanel";
import { cn } from "@/utils/cn";

const fmt = (n: number) => n.toLocaleString("ko-KR");

function planPrice(plan: Plan, ko: boolean) {
  if (plan.priceKrw === null) return ko ? "별도 협의" : "Custom";
  if (plan.priceKrw === 0) return ko ? "무료" : "Free";
  return `₩${fmt(plan.priceKrw)}`;
}

/** 대시보드 안에서 요금제를 확인·비교하고 구독을 관리하는 화면. */
export function PlansView({
  userId,
  currentPlanId,
  billing,
  customerName,
  customerEmail,
}: {
  userId: string;
  currentPlanId: PlanId;
  billing: BillingState;
  customerName: string;
  customerEmail: string;
}) {
  const ko = useLocale() === "ko";
  const tel = `tel:${COMPANY.supportPhone.replace(/-/g, "")}`;
  const currentPlan = PLANS.find((p) => p.id === currentPlanId) ?? PLANS[0];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="eyebrow mb-2">PRICING</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "구독 플랜" : "Plans"}
        </h1>
        <p className="mt-2 text-muted">
          {ko
            ? "필요한 만큼 골라 쓰세요. 사업이 커지면 상위 플랜으로 업그레이드하세요."
            : "Pick the plan that fits. Upgrade as your business grows."}
        </p>
      </div>

      {/* 현재 플랜 요약 */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted">
            {ko ? "현재 플랜" : "Current plan"}
          </p>
          <p className="mt-0.5 text-lg font-bold uppercase tracking-[0.1em]">
            {currentPlan.name[ko ? "ko" : "en"]}
            <span className="tnum ml-2 text-sm font-medium text-muted">
              {planPrice(currentPlan, ko)}
              {currentPlan.priceKrw ? (ko ? "/월" : "/mo") : ""}
            </span>
          </p>
        </div>
        <Link
          href="/dashboard/points"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          {ko ? "사용량 · 결제 내역 보기" : "Usage & billing history"}
        </Link>
      </Card>

      {/* 플랜 카드 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const popular = plan.id === "pro";
          const isCurrent = plan.id === currentPlanId;
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-surface p-6",
                isCurrent
                  ? "border-primary shadow-lg shadow-primary/10"
                  : popular
                    ? "border-primary/50 shadow-sm"
                    : "border-border",
              )}
            >
              {(isCurrent || popular) && (
                <span
                  className={cn(
                    "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-bold",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary-soft text-primary ring-1 ring-inset ring-primary/20",
                  )}
                >
                  {isCurrent
                    ? ko
                      ? "이용 중"
                      : "Current"
                    : ko
                      ? "인기"
                      : "Popular"}
                </span>
              )}
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-muted">
                {ko ? plan.name.ko : plan.name.en}
              </p>
              <p className="tnum mt-3 text-3xl font-bold">
                {planPrice(plan, ko)}
                {plan.priceKrw ? (
                  <span className="text-sm font-medium text-muted">
                    {ko ? " /월" : " /mo"}
                  </span>
                ) : null}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {planFeatureList(plan, ko).map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-primary">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  <span className="inline-flex w-full cursor-default items-center justify-center rounded-xl border border-primary/40 bg-primary-soft px-4 py-2.5 text-sm font-bold text-primary">
                    {ko ? "현재 이용 중" : "Current plan"}
                  </span>
                ) : plan.id === "free" ? (
                  <span className="inline-flex w-full cursor-default items-center justify-center rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted">
                    {ko ? "기본 플랜" : "Default plan"}
                  </span>
                ) : plan.id === "partner" ? (
                  <a
                    href={tel}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition-colors hover:border-primary/60 hover:text-primary"
                  >
                    {ko ? "문의하기" : "Contact us"}
                  </a>
                ) : (
                  <a
                    href="#manage"
                    className="neon-glow inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                  >
                    {ko ? "구독하기" : "Subscribe"}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 구독 시작/변경/해지 */}
      <div id="manage" className="scroll-mt-6">
        <SubscribePanel
          userId={userId}
          currentPlanId={currentPlanId}
          billing={billing}
          customerName={customerName}
          customerEmail={customerEmail}
        />
      </div>
    </div>
  );
}
