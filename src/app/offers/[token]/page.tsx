import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { getOfferByToken, toPublicOffer } from "@/lib/b2b2c/offers";
import { Card } from "@/components/ui/Card";

// 고객별 오퍼는 검색엔진에 노출하지 않는다(토큰 기반 비공개).
export const metadata: Metadata = {
  title: "제안서",
  robots: { index: false, follow: false },
};

const won = (n: number) => `₩${n.toLocaleString()}`;

export default async function OfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!B2B2C_ENABLED) notFound();
  const { token } = await params;
  const row = await getOfferByToken(token);
  if (!row) notFound();
  const offer = toPublicOffer(row);
  const total =
    offer.vatMode === "excluded"
      ? offer.sellPriceKrw
      : offer.sellPriceKrw; // 오퍼 단계는 세금 미확정 — 판매가만 제시

  const expired = offer.status === "expired" || offer.status === "void";

  // 판매자 표기 — 파트너 스토어프론트(있으면).
  let store = null;
  try {
    const admin = (await import("@/lib/supabase/server")).createAdminClient();
    const { data } = await admin
      .from("partner_storefronts")
      .select("slug, display_name, contact")
      .eq("partner_user_id", offer.partnerUserId)
      .maybeSingle();
    store = data;
  } catch {
    store = null;
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <div className="mb-5">
        <p className="eyebrow mb-1">제안서</p>
        <h1 className="text-xl font-semibold tracking-tight">{offer.name}</h1>
      </div>

      <Card className="space-y-4 p-6">
        {offer.description && (
          <p className="text-sm text-muted whitespace-pre-line">
            {offer.description}
          </p>
        )}
        {offer.includedServices && (
          <div className="rounded-lg bg-surface-2 p-3 text-sm whitespace-pre-line">
            {offer.includedServices}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted">판매가</span>
          <span className="text-lg font-semibold">{won(total)}</span>
        </div>
        <p className="text-xs text-muted">
          {offer.vatMode === "included" ? "부가세 포함" : "부가세 별도"}
          {offer.billingType === "recurring"
            ? ` · ${offer.billingPeriod === "monthly" ? "월" : "정기"} 결제`
            : " · 1회 결제"}
        </p>
        {offer.validUntil && !expired && (
          <p className="text-xs text-muted">
            유효기간: {new Date(offer.validUntil).toLocaleDateString("ko-KR")}까지
          </p>
        )}
      </Card>

      {expired ? (
        <Card className="mt-4 p-6 text-center text-sm text-muted">
          만료되었거나 종료된 제안입니다. 판매자에게 문의해주세요.
        </Card>
      ) : (
        <Card className="mt-4 p-6 text-sm">
          <p className="font-semibold">도입을 원하시면</p>
          <p className="mt-1 text-muted">
            판매자가 확정 청구서를 발행해 드립니다. 아래로 문의해주세요.
          </p>
          {store?.contact && (
            <p className="mt-2 font-medium">{store.contact}</p>
          )}
        </Card>
      )}

      {store && (
        <p className="mt-4 text-center text-xs text-muted">
          제공: {store.display_name}
        </p>
      )}
    </main>
  );
}
