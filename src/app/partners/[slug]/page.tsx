import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { getPublicStorefront } from "@/lib/b2b2c/storefront";
import { listPublicProductsBySlug } from "@/lib/b2b2c/products";
import { getUser } from "@/lib/queries";
import { Card } from "@/components/ui/Card";
import { SelfServeBuy } from "@/components/b2b2c/SelfServeBuy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = B2B2C_ENABLED ? await getPublicStorefront(slug) : null;
  return {
    title: store ? store.displayName : "파트너",
    description: store?.intro ?? undefined,
    // 스토어프론트는 공개 소개 페이지 — 색인 허용(판매가는 고객 안내가이므로 노출 가능).
  };
}

const won = (n: number) => `₩${n.toLocaleString()}`;
const PLAN_LABEL: Record<string, string> = { basic: "베이직", pro: "프로" };

/**
 * 파트너 공개 스토어프론트 — 로고·소개 + 파트너가 공개(active)한 상품을 고객이 직접 구매.
 * 구매 시 파트너 브랜드 결제창(/invoices/[token])으로 이동하고, 결제 완료 시 계정이 자동 등업된다.
 * 기본요금·마진은 노출하지 않고 고객 판매가만 표시한다.
 */
export default async function PartnerStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!B2B2C_ENABLED) notFound();
  const { slug } = await params;
  const [store, listing, user] = await Promise.all([
    getPublicStorefront(slug),
    listPublicProductsBySlug(slug),
    getUser(),
  ]);
  if (!store) notFound();
  const products = listing?.products ?? [];
  const isLoggedIn = !!user;

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-12">
      <div className="flex flex-col items-center text-center">
        {store.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.logoUrl}
            alt={store.displayName}
            className="mb-4 size-20 rounded-2xl object-cover"
          />
        ) : (
          <div className="mb-4 flex size-20 items-center justify-center rounded-2xl bg-primary-soft text-2xl font-bold text-primary">
            {store.displayName.slice(0, 1)}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">
          {store.displayName}
        </h1>
        {store.intro && (
          <p className="mt-3 max-w-md text-muted whitespace-pre-line">
            {store.intro}
          </p>
        )}
      </div>

      {/* 공개 상품 — 고객 셀프 구매 */}
      {products.length > 0 && (
        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold">상품 선택</h2>
          {products.map((p) => {
            const total = p.sellPriceKrw;
            return (
              <Card key={p.id} className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    {p.basePlan && (
                      <span className="mt-1 inline-block rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                        {PLAN_LABEL[p.basePlan] ?? p.basePlan} 프로그램
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold">{won(total)}</p>
                    <p className="text-xs text-muted">
                      {p.vatMode === "included" ? "부가세 포함" : "부가세 별도"}
                      {p.billingType === "recurring"
                        ? ` · ${p.billingPeriod === "monthly" ? "월" : "정기"}`
                        : " · 1회"}
                    </p>
                  </div>
                </div>

                {p.description && (
                  <p className="text-sm text-muted whitespace-pre-line">
                    {p.description}
                  </p>
                )}
                {p.includedServices && (
                  <div className="rounded-lg bg-surface-2 p-3 text-sm whitespace-pre-line">
                    {p.includedServices}
                  </div>
                )}

                <SelfServeBuy
                  productId={p.id}
                  slug={slug}
                  isLoggedIn={isLoggedIn}
                />
                {p.basePlan && (
                  <p className="text-center text-xs text-muted">
                    결제 완료 시 계정이 {PLAN_LABEL[p.basePlan] ?? p.basePlan}{" "}
                    프로그램으로 자동 전환됩니다.
                  </p>
                )}
              </Card>
            );
          })}
        </section>
      )}

      <Card className="mt-6 space-y-3 p-6 text-center">
        <h2 className="text-base font-semibold">상담 · 도입 문의</h2>
        <p className="text-sm text-muted">
          {products.length > 0
            ? "맞춤 상담이 필요하시면 아래로 문의해 주세요."
            : "서비스 상품과 도입 조건은 상담을 통해 안내해 드립니다."}
        </p>
        {store.contact && (
          <p className="text-sm font-medium whitespace-pre-line">
            {store.contact}
          </p>
        )}
      </Card>

      {store.sellerInfo && (
        <p className="mt-6 text-center text-xs text-muted whitespace-pre-line">
          {store.sellerInfo}
        </p>
      )}
      <p className="mt-2 text-center text-xs text-muted">
        결제대금은 STORYUP이 수납합니다.
      </p>
    </main>
  );
}
