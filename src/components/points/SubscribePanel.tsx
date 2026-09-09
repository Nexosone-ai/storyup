"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { PLANS, type PlanId } from "@/lib/plans";
import {
  startSubscriptionAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
} from "@/app/dashboard/points/actions";

/** PortOne V2 브라우저 SDK (빌링키 발급) 최소 타입. */
interface PortOneSDK {
  requestIssueBillingKey(opts: {
    storeId: string;
    channelKey: string;
    billingKeyMethod: "CARD";
    issueId: string;
    issueName: string;
    customer?: {
      customerId?: string;
      fullName?: string;
      phoneNumber?: string;
      email?: string;
    };
  }): Promise<{ code?: string; message?: string; billingKey?: string }>;
}

declare global {
  interface Window {
    PortOne?: PortOneSDK;
  }
}

async function loadPortone(): Promise<PortOneSDK> {
  if (window.PortOne) return window.PortOne;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.portone.io/v2/browser-sdk.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("PortOne SDK load failed"));
    document.head.appendChild(s);
  });
  if (!window.PortOne) throw new Error("PortOne SDK unavailable");
  return window.PortOne;
}

export interface BillingState {
  /** 서버에 PortOne 키가 모두 설정됐는지 (미설정이면 버튼 비활성) */
  configured: boolean;
  status: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** 결제 수단이 등록된 유료 구독인지 (false + active = 체험) */
  hasBillingKey: boolean;
}

function fmtDate(iso: string, ko: boolean) {
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** 유료 플랜 구독 시작/변경/해지 — 금액 결정과 검증은 전부 서버에서. */
export function SubscribePanel({
  userId,
  currentPlanId,
  billing,
  customerName,
  customerEmail,
}: {
  userId: string;
  currentPlanId: PlanId;
  billing: BillingState;
  /** 결제자 정보 초기값 — PG(카드사)가 빌링키 발급 시 이름·이메일·휴대폰을 요구한다. */
  customerName: string;
  customerEmail: string;
}) {
  const ko = useLocale() === "ko";
  const router = useRouter();
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, start] = useTransition();
  // 결제자 정보 — 이름·이메일은 프로필에서 채우고, 휴대폰은 직접 입력받는다.
  const [buyerName, setBuyerName] = useState(customerName);
  const [buyerEmail, setBuyerEmail] = useState(customerEmail);
  const [buyerPhone, setBuyerPhone] = useState("");

  const paidPlans = PLANS.filter((p) => p.id === "basic" || p.id === "pro");
  // 기간이 지난 active 행(크론 처리 전)은 만료로 취급 — 기준 시각은 마운트 시점 고정
  const [mountedAt] = useState(() => Date.now());
  const notExpired =
    !billing.periodEnd || new Date(billing.periodEnd).getTime() > mountedAt;
  const active = billing.status === "active" && notExpired;
  const trialing = active && !billing.hasBillingKey;
  const subscribedPaid = active && billing.hasBillingKey;

  const subscribe = (planId: PlanId) =>
    start(async () => {
      setNote(null);
      // PG(카드사)가 빌링키 발급 시 요구하는 결제자 정보 — 하나라도 비면 발급이 거부된다.
      const name = buyerName.trim();
      const email = buyerEmail.trim();
      const phone = buyerPhone.replace(/[^0-9]/g, "");
      if (!name || !email || phone.length < 10) {
        setNote({
          text: ko
            ? "결제자 이름·이메일·휴대폰 번호를 정확히 입력해주세요."
            : "Please enter the payer's name, email, and phone number.",
          error: true,
        });
        return;
      }
      try {
        const portone = await loadPortone();
        const issue = await portone.requestIssueBillingKey({
          storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "",
          channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? "",
          billingKeyMethod: "CARD",
          issueId: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          issueName: "STORYUP 정기결제",
          customer: {
            customerId: userId,
            fullName: name,
            phoneNumber: phone,
            email,
          },
        });
        if (issue.code || !issue.billingKey) {
          // 사용자가 창을 닫은 경우 등 — 결제 시도 전이므로 조용히 안내만
          setNote({
            text:
              issue.message ??
              (ko ? "카드 등록이 완료되지 않았습니다." : "Card registration was not completed."),
            error: true,
          });
          return;
        }
        const res = await startSubscriptionAction(planId, issue.billingKey);
        setNote({
          text:
            res.error ??
            res.message ??
            (ko ? "구독이 시작되었습니다." : "Subscription started."),
          error: !!res.error,
        });
        if (!res.error) router.refresh();
      } catch {
        setNote({
          text: ko
            ? "결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
            : "Failed to load the payment module. Please try again.",
          error: true,
        });
      }
    });

  const runSimple = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote({ text: res.error ?? res.message ?? "완료", error: !!res.error });
      if (!res.error) router.refresh();
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">
        {ko ? "구독 관리" : "Subscription"}
      </h2>

      {/* 현재 구독 상태 */}
      {trialing && billing.periodEnd && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {ko ? "🎁 무료 체험 이용 중" : "🎁 Free trial active"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {ko
                ? `${fmtDate(billing.periodEnd, ko)}까지 Pro 혜택이 유지됩니다. 이후 자동으로 Free 플랜으로 전환돼요 (결제 없음).`
                : `Pro benefits until ${fmtDate(billing.periodEnd, ko)}. Then you'll move to Free automatically (no charge).`}
            </p>
          </div>
        </Card>
      )}
      {subscribedPaid && billing.periodEnd && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {billing.cancelAtPeriodEnd
                ? ko
                  ? "해지 예약됨"
                  : "Cancellation scheduled"
                : ko
                  ? "정기결제 이용 중"
                  : "Auto-renewing"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {billing.cancelAtPeriodEnd
                ? ko
                  ? `${fmtDate(billing.periodEnd, ko)}까지 이용 후 종료됩니다.`
                  : `Access until ${fmtDate(billing.periodEnd, ko)}, then it ends.`
                : ko
                  ? `다음 결제일: ${fmtDate(billing.periodEnd, ko)}`
                  : `Next billing date: ${fmtDate(billing.periodEnd, ko)}`}
            </p>
          </div>
          {billing.cancelAtPeriodEnd ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => runSimple(resumeSubscriptionAction)}
            >
              {ko ? "구독 계속하기" : "Keep subscription"}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    ko
                      ? "구독을 해지할까요? 남은 기간까지는 그대로 이용할 수 있습니다."
                      : "Cancel the subscription? You keep access until the period ends.",
                  )
                )
                  runSimple(cancelSubscriptionAction);
              }}
            >
              {ko ? "해지" : "Cancel"}
            </Button>
          )}
        </Card>
      )}

      {/* 결제자 정보 — 카드사 빌링키 발급에 필요 (이름·이메일·휴대폰) */}
      {!subscribedPaid && billing.configured && (
        <Card className="space-y-3">
          <p className="text-sm font-medium">
            {ko ? "결제자 정보" : "Payer information"}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="buyer-name">{ko ? "이름" : "Name"}</Label>
              <Input
                id="buyer-name"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder={ko ? "홍길동" : "Full name"}
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="buyer-email">{ko ? "이메일" : "Email"}</Label>
              <Input
                id="buyer-email"
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="buyer-phone">{ko ? "휴대폰 번호" : "Phone"}</Label>
              <Input
                id="buyer-phone"
                type="tel"
                inputMode="numeric"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="010-1234-5678"
                autoComplete="tel"
              />
            </div>
          </div>
        </Card>
      )}

      {/* 플랜 선택 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {paidPlans.map((plan) => {
          const isCurrent = subscribedPaid && currentPlanId === plan.id;
          return (
            <Card key={plan.id} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <p className="text-base font-bold uppercase tracking-[0.1em]">
                  {plan.name[ko ? "ko" : "en"]}
                </p>
                {isCurrent && (
                  <Badge tone="success">{ko ? "이용 중" : "Current"}</Badge>
                )}
              </div>
              <p className="tnum text-2xl font-bold">
                ₩{(plan.priceKrw ?? 0).toLocaleString()}
                <span className="text-sm font-medium text-muted">
                  {ko ? "/월" : "/mo"}
                </span>
              </p>
              <ul className="space-y-1 text-sm text-muted">
                <li>
                  {ko
                    ? `매월 ${plan.monthlyPoints?.toLocaleString()} UP 지급`
                    : `${plan.monthlyPoints?.toLocaleString()} UP every month`}
                </li>
                <li>
                  {ko
                    ? `랜딩페이지 ${plan.limits.sites}개 · 블로그 ${plan.limits.blogPosts}건/월`
                    : `${plan.limits.sites} landing pages · ${plan.limits.blogPosts} blog posts/mo`}
                </li>
                <li>
                  {ko
                    ? `카드뉴스 ${plan.limits.cardNews}건 · AI 이미지 ${plan.limits.aiImages}개/월`
                    : `${plan.limits.cardNews} card news · ${plan.limits.aiImages} AI images/mo`}
                </li>
              </ul>
              <Button
                className="mt-auto"
                disabled={busy || !billing.configured || isCurrent}
                onClick={() => subscribe(plan.id)}
              >
                {busy ? (
                  <Spinner className="size-4" />
                ) : !billing.configured ? (
                  ko ? "결제 오픈 준비 중" : "Payments coming soon"
                ) : isCurrent ? (
                  ko ? "이용 중" : "Current plan"
                ) : subscribedPaid ? (
                  ko ? "이 플랜으로 변경" : "Switch to this plan"
                ) : (
                  ko ? "구독하기" : "Subscribe"
                )}
              </Button>
            </Card>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-muted">
        {ko
          ? "구독 시 즉시 1개월분이 결제되고 매월 같은 날 자동 갱신됩니다. 플랜 변경 시에도 새 플랜 금액이 즉시 결제되며 오늘부터 1개월 주기가 새로 시작돼요. 해지하면 남은 기간까지 이용 후 자동 종료됩니다."
          : "Subscribing charges one month immediately and renews monthly. Switching plans charges the new price right away and restarts the monthly cycle. Cancelling keeps access until the period ends."}
      </p>
      {note && (
        <p className={`text-sm ${note.error ? "text-danger" : "text-primary"}`}>
          {note.text}
        </p>
      )}
    </section>
  );
}
