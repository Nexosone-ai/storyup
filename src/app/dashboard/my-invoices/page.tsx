import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { listClientInvoices, toPublicInvoice } from "@/lib/b2b2c/invoices";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "내 청구서" };

const won = (n: number) => `₩${n.toLocaleString()}`;
const STATUS: Record<string, string> = {
  issued: "발행됨",
  pending_payment: "결제 대기",
  paid: "결제 완료",
  void: "무효",
  refunded: "환불됨",
};

/**
 * 고객(클라이언트) 전용 — 자신에게 발행된 청구서·결제상태·이용 한도만 확인.
 * 기본요금·마진·다른 고객 정보는 노출하지 않는다.
 */
export default async function MyInvoicesPage() {
  if (!B2B2C_ENABLED) notFound();
  const user = await getUser();
  if (!user) notFound();

  const rows = await listClientInvoices(user.id);
  const invoices = rows.map(toPublicInvoice);
  const planId = await getPlanId(user.id);
  const plan = getPlanById(planId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="eyebrow mb-2">내 청구서</p>
        <h1 className="text-2xl font-semibold tracking-tight">청구서 · 이용 한도</h1>
        <p className="mt-1.5 text-muted">
          제공받은 상품의 최종 금액과 결제 상태, 현재 이용 한도를 확인하세요.
        </p>
      </div>

      {/* 현재 이용 한도 — 파트너 판매가와 무관하게 기존 요금제 정책 그대로. */}
      <Card className="p-5">
        <p className="text-sm font-semibold">
          현재 플랜: {plan.name.ko}
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted">
          <li>랜딩페이지 {limitText(plan.limits.sites)}</li>
          <li>블로그 {limitText(plan.limits.blogPosts)}/월</li>
          <li>카드뉴스 {limitText(plan.limits.cardNews)}/월</li>
          <li>쇼츠 {limitText(plan.limits.shorts)}/월</li>
        </ul>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">청구서</h2>
        {invoices.length === 0 && (
          <p className="text-sm text-muted">발행된 청구서가 없습니다.</p>
        )}
        {invoices.map((i) => {
          const total =
            i.vatMode === "excluded" ? i.sellPriceKrw + i.taxKrw : i.sellPriceKrw;
          return (
            <Card
              key={i.token}
              className="flex items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{i.name || i.number}</p>
                <p className="text-sm text-muted">
                  {won(total)} · {STATUS[i.status] ?? i.status}
                </p>
              </div>
              <Link
                href={`/invoices/${i.token}`}
                className="shrink-0 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold hover:border-primary/50"
              >
                {i.status === "paid" ? "보기" : "결제/보기"}
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function limitText(v: number | null): string {
  return v === null ? "협의" : String(v);
}
