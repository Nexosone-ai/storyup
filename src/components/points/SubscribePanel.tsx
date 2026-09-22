"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import PortOne from "@portone/browser-sdk/v2";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { PLANS, getPlanById, type PlanId } from "@/lib/plans";
import { formatPhone } from "@/utils/phone";
import { BANK_ACCOUNT, bankAccountConfigured } from "@/lib/company";
import {
  startSubscriptionAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
  requestBankTransferAction,
} from "@/app/dashboard/points/actions";

export interface BillingState {
  /** 서버에 PortOne 키가 모두 설정됐는지 (미설정이면 버튼 비활성) */
  configured: boolean;
  status: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** 결제 수단이 등록된 유료 구독인지 (false + active = 체험) */
  hasBillingKey: boolean;
  /** 입금 확인 대기 중인 계좌이체 신청 (없으면 null) */
  pendingBankTransfer?: {
    plan: PlanId;
    amount: number;
    depositorName: string;
  } | null;
}

type PayMethod = "card" | "bank";

function fmtDate(iso: string, ko: boolean) {
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface SubscribePanelHandle {
  /** 외부(요금제 카드 등)에서 결제 모달을 여는 트리거. */
  openModal: (planId: PlanId) => void;
}

interface SubscribePanelProps {
  userId: string;
  currentPlanId: PlanId;
  billing: BillingState;
  /** 결제자 정보 초기값 — PG(카드사)가 빌링키 발급 시 이름·이메일·휴대폰을 요구한다. */
  customerName: string;
  customerEmail: string;
  /** 플랜 선택 그리드 노출 여부. 상위에서 별도 카드로 구독을 트리거할 땐 false. */
  showPlanGrid?: boolean;
}

/** 유료 플랜 구독 시작/변경/해지 — 금액 결정과 검증은 전부 서버에서. */
export const SubscribePanel = forwardRef<
  SubscribePanelHandle,
  SubscribePanelProps
>(function SubscribePanel(
  {
    userId,
    currentPlanId,
    billing,
    customerName,
    customerEmail,
    showPlanGrid = true,
  },
  ref,
) {
  const ko = useLocale() === "ko";
  const router = useRouter();
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, start] = useTransition();
  // 결제자 정보 — 이름·이메일은 프로필에서 채우고, 휴대폰은 직접 입력받는다.
  const [buyerName, setBuyerName] = useState(customerName);
  const [buyerEmail, setBuyerEmail] = useState(customerEmail);
  const [buyerPhone, setBuyerPhone] = useState("");
  // 구독하기 클릭 시 뜨는 결제 창(모달)에서 어떤 플랜을 구독할지
  const [modalPlan, setModalPlan] = useState<PlanId | null>(null);
  // 결제 수단 선택 — 카드결제(PortOne) / 계좌이체(관리자 수동 승인)
  const [method, setMethod] = useState<PayMethod>("card");
  const [depositor, setDepositor] = useState(customerName);
  const bankReady = bankAccountConfigured();

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
        const issue = await PortOne.requestIssueBillingKey({
          storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "",
          // 정기결제(빌링)는 일반결제와 채널이 다르다 — 빌링 채널키 우선, 없으면 기존 키로 폴백
          channelKey:
            process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_BILLING ||
            process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ||
            "",
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
        if (!issue || issue.code || !issue.billingKey) {
          // 사용자가 창을 닫은 경우 등 — 결제 시도 전이므로 조용히 안내만.
          // PG 원본 메시지("빌링키 발급 취소")는 사용자에게 낯설어, 취소는 우리 문구로 바꾼다.
          const raw = issue?.message ?? "";
          const cancelled = !raw || /취소|cancel/i.test(raw);
          setNote({
            text: cancelled
              ? ko
                ? "사용자가 정기결제를 취소하였습니다."
                : "You cancelled the subscription registration."
              : raw ||
                (ko
                  ? "카드 등록이 완료되지 않았습니다."
                  : "Card registration was not completed."),
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
        if (!res.error) {
          setModalPlan(null); // 성공 시 결제 창 닫기
          router.refresh();
        }
      } catch {
        setNote({
          text: ko
            ? "결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
            : "Failed to load the payment module. Please try again.",
          error: true,
        });
      }
    });

  // 계좌이체 신청 — 입금자명만 받아 접수하고, 관리자 승인 후 활성화된다.
  const requestBank = (planId: PlanId) =>
    start(async () => {
      setNote(null);
      const name = depositor.trim();
      if (!name) {
        setNote({
          text: ko ? "입금자명을 입력해주세요." : "Please enter the depositor's name.",
          error: true,
        });
        return;
      }
      const res = await requestBankTransferAction(planId, name);
      setNote({
        text: res.error ?? res.message ?? (ko ? "신청되었습니다." : "Requested."),
        error: !!res.error,
      });
      if (!res.error) {
        setModalPlan(null);
        router.refresh();
      }
    });

  const openModal = useCallback(
    (planId: PlanId) => {
      setNote(null);
      // 카드 설정이 안 됐으면 계좌이체를 기본 선택
      setMethod(billing.configured ? "card" : "bank");
      setModalPlan(planId);
    },
    [billing.configured],
  );

  // 상위(요금제 카드)에서 결제 모달을 직접 열 수 있도록 노출
  useImperativeHandle(ref, () => ({ openModal }), [openModal]);

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
                ? `${fmtDate(billing.periodEnd, ko)}까지 ${getPlanById(currentPlanId).name.ko} 혜택이 유지됩니다. 이후 자동으로 Free 플랜으로 전환돼요 (결제 없음).`
                : `${getPlanById(currentPlanId).name.en} benefits until ${fmtDate(billing.periodEnd, ko)}. Then you'll move to Free automatically (no charge).`}
            </p>
          </div>
        </Card>
      )}
      {billing.pendingBankTransfer && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary-soft/30">
          <div>
            <p className="text-sm font-medium">
              {ko ? "🏦 입금 확인 대기 중" : "🏦 Awaiting deposit confirmation"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {ko
                ? `${getPlanById(billing.pendingBankTransfer.plan).name.ko} 플랜 · ₩${billing.pendingBankTransfer.amount.toLocaleString()} · 입금자명 ${billing.pendingBankTransfer.depositorName} — 입금이 확인되면 관리자가 활성화해 드립니다.`
                : `${getPlanById(billing.pendingBankTransfer.plan).name.en} · ₩${billing.pendingBankTransfer.amount.toLocaleString()} · depositor ${billing.pendingBankTransfer.depositorName} — activated once your deposit is confirmed.`}
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

      {/* 플랜 선택 — 요금제 페이지처럼 상위 카드가 구독을 트리거하면 숨긴다. */}
      {showPlanGrid && (
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
                disabled={
                  busy ||
                  isCurrent ||
                  (!billing.configured && !bankReady)
                }
                onClick={() => openModal(plan.id)}
              >
                {busy ? (
                  <Spinner className="size-4" />
                ) : !billing.configured && !bankReady ? (
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
      )}

      <p className="text-xs leading-relaxed text-muted">
        {ko
          ? "구독 시 즉시 1개월분이 결제되고 매월 같은 날 자동 갱신됩니다. 플랜 변경 시에도 새 플랜 금액이 즉시 결제되며 오늘부터 1개월 주기가 새로 시작돼요. 해지하면 남은 기간까지 이용 후 자동 종료됩니다."
          : "Subscribing charges one month immediately and renews monthly. Switching plans charges the new price right away and restarts the monthly cycle. Cancelling keeps access until the period ends."}
      </p>
      {note && !modalPlan && (
        <p className={`text-sm ${note.error ? "text-danger" : "text-primary"}`}>
          {note.text}
        </p>
      )}

      {/* 결제 창(모달) — 구독하기 클릭 시 열려 결제자 정보 입력 후 결제 진행 */}
      {modalPlan &&
        (() => {
          if (!modalPlan) return null;
          const plan = getPlanById(modalPlan);
          const close = () => {
            if (busy) return;
            setModalPlan(null);
            setNote(null);
          };
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
                onClick={close}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={ko ? "구독 결제" : "Subscription checkout"}
                className="relative z-10 w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold uppercase tracking-[0.1em]">
                      {plan.name[ko ? "ko" : "en"]}
                      {subscribedPaid && (
                        <span className="ml-2 text-xs font-medium text-muted">
                          {ko ? "플랜 변경" : "Switch plan"}
                        </span>
                      )}
                    </p>
                    <p className="tnum mt-1 text-2xl font-bold">
                      ₩{(plan.priceKrw ?? 0).toLocaleString()}
                      <span className="text-sm font-medium text-muted">
                        {ko ? " /월" : " /mo"}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={ko ? "닫기" : "Close"}
                    onClick={close}
                    className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                  >
                    <Icon.x width={18} height={18} />
                  </button>
                </div>

                {/* 결제 수단 선택 — 카드결제 / 계좌이체 (둘 다 가능할 때만 노출) */}
                {billing.configured && bankReady && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {(["card", "bank"] as PayMethod[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setMethod(m);
                          setNote(null);
                        }}
                        disabled={busy}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                          method === m
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border text-muted hover:border-primary/50"
                        }`}
                      >
                        {m === "card"
                          ? ko
                            ? "카드 결제"
                            : "Card"
                          : ko
                            ? "계좌이체"
                            : "Bank transfer"}
                      </button>
                    ))}
                  </div>
                )}

                {method === "card" ? (
                  <>
                    <p className="mt-4 text-xs leading-relaxed text-muted">
                      {ko
                        ? "즉시 1개월분이 결제되고 매월 같은 날 자동 갱신됩니다. 카드 등록을 위해 결제자 정보가 필요합니다."
                        : "One month is charged now and renews monthly. Your details are needed to register the card."}
                    </p>

                    {/* 결제자 정보 — 카드사 빌링키 발급 필수 항목 */}
                    <div className="mt-4 space-y-3">
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
                        <Label htmlFor="buyer-email">
                          {ko ? "이메일" : "Email"}
                        </Label>
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
                        <Label htmlFor="buyer-phone">
                          {ko ? "휴대폰 번호" : "Phone"}
                        </Label>
                        <Input
                          id="buyer-phone"
                          type="tel"
                          inputMode="numeric"
                          value={buyerPhone}
                          onChange={(e) => setBuyerPhone(formatPhone(e.target.value))}
                          placeholder="010-1234-5678"
                          autoComplete="tel"
                          maxLength={13}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-4 text-xs leading-relaxed text-muted">
                      {ko
                        ? "아래 계좌로 1개월 이용료를 입금해주세요. 입금이 확인되면 관리자가 1개월 이용을 활성화해 드립니다. (계좌이체는 자동 갱신되지 않아 매월 신청이 필요합니다.)"
                        : "Transfer one month's fee to the account below. Once confirmed, an admin activates your 1-month access. (Bank transfer does not auto-renew.)"}
                    </p>

                    {/* 입금 계좌 안내 */}
                    <div className="mt-4 space-y-1.5 rounded-xl border border-border bg-surface-muted p-4 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted">{ko ? "입금 금액" : "Amount"}</span>
                        <span className="tnum font-bold">
                          ₩{(plan.priceKrw ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted">{ko ? "은행" : "Bank"}</span>
                        <span className="font-medium">{BANK_ACCOUNT.bank}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted">{ko ? "계좌번호" : "Account"}</span>
                        <span className="select-all font-mono font-medium">
                          {BANK_ACCOUNT.number}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted">{ko ? "예금주" : "Holder"}</span>
                        <span className="font-medium">{BANK_ACCOUNT.holder}</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Label htmlFor="depositor">
                        {ko ? "입금자명" : "Depositor name"}
                      </Label>
                      <Input
                        id="depositor"
                        value={depositor}
                        onChange={(e) => setDepositor(e.target.value)}
                        placeholder={ko ? "실제 입금하실 이름" : "Name on the transfer"}
                        maxLength={60}
                        autoComplete="name"
                      />
                      <p className="mt-1.5 text-xs text-muted">
                        {ko
                          ? "입금내역 대조를 위해 실제 입금자명을 정확히 입력해주세요."
                          : "Enter the exact depositor name so we can match your transfer."}
                      </p>
                    </div>
                  </>
                )}

                {note && (
                  <p
                    className={`mt-3 text-sm ${note.error ? "text-danger" : "text-primary"}`}
                  >
                    {note.text}
                  </p>
                )}

                <div className="mt-5 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={close}
                    disabled={busy}
                  >
                    {ko ? "취소" : "Cancel"}
                  </Button>
                  {method === "card" ? (
                    <Button
                      className="flex-1"
                      onClick={() => subscribe(modalPlan)}
                      disabled={busy}
                    >
                      {busy ? (
                        <Spinner className="size-4" />
                      ) : ko ? (
                        "카드 등록하고 결제"
                      ) : (
                        "Register card & pay"
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="flex-1"
                      onClick={() => requestBank(modalPlan)}
                      disabled={busy}
                    >
                      {busy ? (
                        <Spinner className="size-4" />
                      ) : ko ? (
                        "입금 완료 · 신청하기"
                      ) : (
                        "I've paid · Request"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </section>
  );
});
