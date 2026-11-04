"use server";

import { B2B2C_ENABLED } from "@/lib/b2b2c/config";

/**
 * (상담형 전환) 공개 스토어프론트의 셀프서비스 직접 구매는 비활성화되었다.
 * 공개 페이지에는 가격을 노출하지 않으며, 가격·결제는 파트너가 고객에게 직접 보낸
 * 오퍼(/offers/[token])·청구서(/invoices/[token])에서만 진행된다.
 * (시그니처는 유지해 향후 파트너별 토글 도입 시 재사용한다.)
 */
export async function startSelfServeCheckoutAction(
  productId: string,
  slug: string,
): Promise<{ error?: string }> {
  void productId;
  void slug;
  if (!B2B2C_ENABLED) return { error: "이용할 수 없습니다." };
  return {
    error: "직접 구매 대신 상담으로 진행됩니다. 담당 파트너에게 문의해 주세요.",
  };
}
