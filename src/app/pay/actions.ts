"use server";

import {
  createProductOrder,
  syncProductOrder,
  type CreatedOrder,
} from "@/lib/payments/orders";

/** 결제창을 열기 위한 주문 생성 — 로그인 불필요(익명 결제). */
export async function createProductOrderAction(
  productId: string,
  buyer: { name: string; phone: string; email: string },
  refCode?: string | null,
): Promise<{ order?: CreatedOrder; error?: string }> {
  const name = (buyer.name ?? "").trim();
  const email = (buyer.email ?? "").trim();
  const phone = (buyer.phone ?? "").replace(/[^0-9]/g, "");
  // PG(카드사)가 결제 시 요구하는 구매자 정보 — 하나라도 비면 결제가 거부된다.
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || phone.length < 10)
    return { error: "이름·이메일·휴대폰 번호를 정확히 입력해주세요." };
  if (!productId) return { error: "상품 정보가 올바르지 않습니다." };

  return createProductOrder({
    productId,
    buyer: { name, phone, email },
    refCode: refCode ?? null,
  });
}

/** 결제창 종료 후 상태 확정 — PortOne API 재검증(멱등). */
export async function confirmProductOrderAction(
  orderId: string,
): Promise<{ status: string; error?: string }> {
  if (!orderId.startsWith("ord_"))
    return { status: "FAILED", error: "주문 정보가 올바르지 않습니다." };
  const res = await syncProductOrder(orderId);
  return { status: res.status, error: res.error };
}
