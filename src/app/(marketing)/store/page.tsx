import Link from "next/link";
import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { getLocale } from "@/lib/i18n";
import { listActiveProducts } from "@/lib/payments/orders";

export const metadata: Metadata = {
  title: "스토어",
  description: "STORYUP 상품을 카드로 간편하게 결제하세요.",
  alternates: { canonical: "/store" },
};

// 관리자가 상품을 등록/변경하면 즉시 반영되도록 요청 시점 렌더링.
export const dynamic = "force-dynamic";

export default async function StorePage() {
  const ko = (await getLocale()) === "ko";
  const products = await listActiveProducts();

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="flex-1 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="eyebrow mb-2 !text-primary">STORE</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {ko ? "스토어" : "Store"}
            </h1>
            <p className="mt-3 text-muted">
              {ko
                ? "원하는 상품을 선택하고 카드로 바로 결제하세요."
                : "Choose a product and pay by card right away."}
            </p>
          </div>

          {products.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center text-muted">
              {ko
                ? "현재 판매 중인 상품이 없습니다."
                : "No products are on sale right now."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface"
                >
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- 원격 스토리지 URL
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="aspect-video w-full object-cover"
                    />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="break-keep-kr text-lg font-bold tracking-tight">
                      {p.name}
                    </h2>
                    {p.description &&
                      (p.description.includes(" · ") ? (
                        <ul className="mt-2 space-y-1 text-sm text-muted">
                          {p.description
                            .split(" · ")
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((f, i) => (
                              <li key={i} className="flex gap-1.5">
                                <span className="mt-0.5 shrink-0 text-primary">✓</span>
                                <span className="break-keep-kr">{f}</span>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
                          {p.description}
                        </p>
                      ))}
                    <p className="tnum mt-auto pt-4 text-2xl font-bold">
                      ₩{p.price.toLocaleString()}
                    </p>
                    <Link
                      href={`/pay/${p.slug}`}
                      className="neon-glow mt-3 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                    >
                      {ko ? "상세보기" : "View details"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-muted">
            {ko ? (
              <>
                안전한 카드 결제 · PortOne(KG이니시스) 제공. 결제 전 상품 내용을
                확인해주세요. 구매의 취소·환불은{" "}
                <Link href="/refund-policy" className="text-primary underline">
                  취소·환불 정책
                </Link>
                을 따릅니다.
              </>
            ) : (
              <>
                Secure card payment via PortOne (KG Inicis). Cancellations and
                refunds follow our{" "}
                <Link href="/refund-policy" className="text-primary underline">
                  refund policy
                </Link>
                .
              </>
            )}
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
