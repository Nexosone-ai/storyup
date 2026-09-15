import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveProductBySlug } from "@/lib/payments/orders";
import { createClient } from "@/lib/supabase/server";
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

  // 로그인 사용자면 가입 정보(이름·이메일)를 결제 폼에 미리 채운다.
  // 이메일이 계정과 일치해야 결제 후 플랜 자동 지급도 정확히 연결된다.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let defaultName = "";
  let defaultEmail = user?.email ?? "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", user.id)
      .maybeSingle();
    defaultName = profile?.name ?? "";
    defaultEmail = profile?.email ?? user.email ?? "";
  }

  // 설명이 " · "로 나열된 형태면 항목별 체크리스트로 정확히 표시
  const features =
    product.description && product.description.includes(" · ")
      ? product.description.split(" · ").map((s) => s.trim()).filter(Boolean)
      : null;

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
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
        <h1 className="break-keep-kr mt-1 text-xl font-bold tracking-tight">
          {product.name}
        </h1>
        {features ? (
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            {features.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 shrink-0 text-primary">✓</span>
                <span className="break-keep-kr">{f}</span>
              </li>
            ))}
          </ul>
        ) : product.description ? (
          <p className="break-keep-kr mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
            {product.description}
          </p>
        ) : null}
        <p className="tnum mt-4 text-3xl font-bold">
          ₩{product.price.toLocaleString()}
        </p>

        <div className="my-5 h-px bg-border" />

        <CheckoutForm
          productId={product.id}
          slug={product.slug}
          refCode={ref ?? null}
          defaultName={defaultName}
          defaultEmail={defaultEmail}
        />

        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          안전한 카드 결제 · PortOne(KG이니시스) 제공
        </p>
      </div>

      {/* 상품 상세 이미지 — 상품을 정확히 소개하는 긴 이미지 */}
      {product.detail_image_url && (
        <div className="mt-8">
          <p className="mb-3 text-sm font-semibold text-foreground">상품 상세</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- 원격 스토리지 URL */}
          <img
            src={product.detail_image_url}
            alt={`${product.name} 상세 이미지`}
            className="w-full rounded-2xl border border-border"
          />
        </div>
      )}
    </main>
  );
}
