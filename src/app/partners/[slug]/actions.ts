"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { issueInvoiceFromProduct } from "@/lib/b2b2c/invoices";

/**
 * 셀프서비스 구매 시작 — 고객이 공개 스토어프론트에서 상품을 직접 결제한다.
 * 로그인 필수(결제 완료 시 이 계정이 등업되므로 계정을 확정해야 함). 미로그인 시 로그인으로 이동.
 * 성공하면 파트너 브랜드 결제창(/invoices/[token])으로 이동한다.
 */
export async function startSelfServeCheckoutAction(
  productId: string,
  slug: string,
): Promise<{ error?: string }> {
  if (!B2B2C_ENABLED) return { error: "이용할 수 없습니다." };
  const user = await getUser();
  if (!user)
    redirect(`/login?redirect=${encodeURIComponent(`/partners/${slug}`)}`);

  const { token, error } = await issueInvoiceFromProduct(user.id, productId);
  if (error || !token) return { error: error ?? "구매를 시작하지 못했습니다." };

  redirect(`/invoices/${token}`);
}
