import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveProductBySlug } from "@/lib/payments/orders";
import { CheckoutForm } from "@/components/pay/CheckoutForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug);
  if (!product) return { title: "결제" };
  return {
    title: `${product.name} 결제`,
    description: product.description ?? `${product.name} · ₩${product.price.toLocaleString()}`,
  };
}

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { slug } = await params;
  const { ref } = await searchParams;
  const product = await getActiveProductBySlug(slug);
  if (!product) notFound();

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        {product.image_url && (
          // 상품 이미지는 외부 스토리지 URL — next/image 원격 설정 회피 위해 img 사용
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="mb-5 aspect-video w-full rounded-xl object-cover"
          />
        )}
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted">
          STORYUP
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{product.name}</h1>
        {product.description && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
            {product.description}
          </p>
        )}
        <p className="tnum mt-4 text-3xl font-bold">
          ₩{product.price.toLocaleString()}
        </p>

        <div className="my-5 h-px bg-border" />

        <CheckoutForm
          productId={product.id}
          slug={product.slug}
          refCode={ref ?? null}
        />

        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          안전한 카드 결제 · PortOne(KG이니시스) 제공
        </p>
      </div>
    </main>
  );
}
