import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { getPublicStorefront } from "@/lib/b2b2c/storefront";
import { Card } from "@/components/ui/Card";

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
    // 스토어프론트는 공개 소개 페이지 — 색인 허용(가격 없음).
  };
}

/**
 * 파트너 공개 스토어프론트 — 로고·소개·연락처 + 상담/도입 문의.
 * 기본요금·마진·판매가는 노출하지 않는다(상품은 고객별 오퍼/청구서로만 제시).
 */
export default async function PartnerStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!B2B2C_ENABLED) notFound();
  const { slug } = await params;
  const store = await getPublicStorefront(slug);
  if (!store) notFound();

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

      <Card className="mt-8 space-y-3 p-6 text-center">
        <h2 className="text-base font-semibold">상담 · 도입 문의</h2>
        <p className="text-sm text-muted">
          서비스 상품과 도입 조건은 상담을 통해 안내해 드립니다.
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
    </main>
  );
}
