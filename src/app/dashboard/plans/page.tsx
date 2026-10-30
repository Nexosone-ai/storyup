import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser, getProfileName } from "@/lib/queries";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { getSubscriptionRow } from "@/lib/payments/billing";
import { getPendingBankTransfer } from "@/lib/payments/bankTransfer";
import { isBillingConfigured, isPaymentsConfigured } from "@/lib/payments/portone";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { isExternalPartnerClient } from "@/lib/b2b2c/clients";
import { Card } from "@/components/ui/Card";
import { PlansView } from "@/components/plans/PlansView";

export const metadata: Metadata = { title: "구독 플랜" };

export default async function PlansPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  // 외부 파트너 고객은 기본요금표를 보지 않는다(파트너가 상품으로 제공).
  // 서버에서 분기 — PlansView(가격 포함 번들)를 아예 렌더하지 않아 가격이 노출되지 않는다.
  if (B2B2C_ENABLED && (await isExternalPartnerClient(user.id))) {
    const planId = await getPlanId(user.id);
    const plan = getPlanById(planId);
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <p className="eyebrow mb-2">구독</p>
          <h1 className="text-2xl font-semibold tracking-tight">구독 관리</h1>
        </div>
        <Card className="p-6">
          <p className="text-sm text-muted">현재 플랜</p>
          <p className="mt-1 text-xl font-semibold">{plan.name.ko}</p>
          <p className="mt-3 text-sm text-muted">
            구독 상품·결제는 담당 파트너를 통해 제공됩니다. 청구서와 결제
            상태는 아래에서 확인하세요.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/my-invoices"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              내 청구서
            </Link>
            <Link
              href="/dashboard/points"
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary/50"
            >
              사용량 · 내역
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const [planId, subRow, pendingBankTransfer, profileName] = await Promise.all([
    getPlanId(user.id),
    getSubscriptionRow(user.id),
    getPendingBankTransfer(user.id),
    getProfileName(),
  ]);

  return (
    <PlansView
      userId={user.id}
      currentPlanId={planId}
      billing={{
        configured: isBillingConfigured(),
        payConfigured: isPaymentsConfigured(),
        status: subRow?.status ?? null,
        periodEnd: subRow?.current_period_end ?? null,
        // 0017 이전 DB에서는 컬럼이 없어 undefined — 안전 기본값으로
        cancelAtPeriodEnd: !!subRow?.cancel_at_period_end,
        hasBillingKey: !!subRow?.billing_key,
        pendingBankTransfer: pendingBankTransfer
          ? {
              plan: pendingBankTransfer.plan,
              amount: pendingBankTransfer.amount,
              depositorName: pendingBankTransfer.depositorName,
            }
          : null,
      }}
      customerName={profileName}
      customerEmail={user.email ?? ""}
    />
  );
}
