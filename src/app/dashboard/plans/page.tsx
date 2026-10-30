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
import { listActiveStorefronts } from "@/lib/b2b2c/storefront";
import { COMPANY } from "@/lib/company";
import { Card } from "@/components/ui/Card";
import { PlansView } from "@/components/plans/PlansView";

export const metadata: Metadata = { title: "구독 플랜" };

export default async function PlansPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  // B2B2C 모드: 모든 고객에게 기본요금표를 숨긴다(파트너가 상품으로 제공).
  // 서버에서 분기 — PlansView(가격 포함 번들)를 아예 렌더하지 않아 가격이 노출되지 않는다.
  // 도입 문의 + 파트너 선택(활성 파트너 목록)을 제공한다.
  if (B2B2C_ENABLED) {
    const [planId, partners] = await Promise.all([
      getPlanId(user.id),
      listActiveStorefronts(),
    ]);
    const plan = getPlanById(planId);
    const tel = `tel:${COMPANY.supportPhone.replace(/-/g, "")}`;
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="eyebrow mb-2">구독</p>
          <h1 className="text-2xl font-semibold tracking-tight">구독 관리</h1>
          <p className="mt-2 text-sm text-muted">
            STORYUP은 전문 파트너를 통해 비즈니스에 맞춰 도입됩니다. 도입을
            원하시면 파트너를 선택해 상담하세요.
          </p>
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

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">도입 파트너 선택</p>
            {partners.length > 0 && (
              <span className="text-xs text-muted">
                {partners.length}개 파트너
              </span>
            )}
          </div>
          {partners.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              현재 안내 가능한 파트너가 없습니다. 아래로 도입 문의를
              남겨주시면 담당자가 연결해 드립니다.
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {partners.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/partners/${p.slug}`}
                    className="flex items-center justify-between rounded-xl border border-border px-4 py-3 transition-colors hover:border-primary/50"
                  >
                    <span>
                      <span className="block text-sm font-semibold">
                        {p.displayName}
                      </span>
                      {p.intro && (
                        <span className="mt-0.5 block text-xs text-muted">
                          {p.intro}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-primary">
                      상담 →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs text-muted">직접 도입 문의도 가능합니다.</p>
            <a
              href={tel}
              className="mt-2 inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-primary/60 hover:text-primary"
            >
              도입 문의하기 ({COMPANY.supportPhone})
            </a>
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
