"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { startSelfServeCheckoutAction } from "@/app/partners/[slug]/actions";

/**
 * 공개 스토어프론트의 상품 '구매하기' 버튼.
 * - 미로그인: 로그인 페이지로 유도(로그인 후 다시 이 스토어로 복귀).
 * - 로그인: 셀프 구매 액션 호출 → 성공 시 브랜드 결제창으로 리다이렉트(액션 내부에서 처리).
 */
export function SelfServeBuy({
  productId,
  slug,
  isLoggedIn,
  label = "구매하기",
}: {
  productId: string;
  slug: string;
  isLoggedIn: boolean;
  label?: string;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?redirect=${encodeURIComponent(`/partners/${slug}`)}`}
        className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        로그인 후 구매
      </Link>
    );
  }

  const buy = () =>
    start(async () => {
      setErr(null);
      const res = await startSelfServeCheckoutAction(productId, slug);
      // 성공 시 액션이 리다이렉트하므로 여기 도달하면 보통 오류.
      if (res?.error) setErr(res.error);
    });

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={buy} disabled={busy}>
        {busy ? <Spinner className="size-4" /> : label}
      </Button>
      {err && <p className="text-sm text-danger">{err}</p>}
    </div>
  );
}
