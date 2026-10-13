import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { getPortonePayment } from "@/lib/payments/portone";
import { creditDeposit } from "./wallet";

export interface CreatedAdDeposit {
  orderId: string;
  orderName: string;
  amount: number;
  currency: "KRW";
  storeId: string;
  channelKey: string;
}

const MIN_DEPOSIT = 10000;

/** 광고 지갑 충전 주문 생성(결제창 직전). 금액은 서버가 검증·고정. */
export async function createAdDeposit(
  businessId: string,
  amount: number,
): Promise<{ order?: CreatedAdDeposit; error?: string }> {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  if (!storeId || !channelKey || !process.env.PORTONE_API_SECRET)
    return { error: "결제 설정이 완료되지 않았습니다." };
  const amt = Math.round(amount || 0);
  if (!Number.isInteger(amt) || amt < MIN_DEPOSIT)
    return { error: `최소 충전 금액은 ₩${MIN_DEPOSIT.toLocaleString()} 입니다.` };

  const admin = createAdminClient();
  const orderId = `adw_${randomUUID()}`;
  const { error } = await admin.from("ad_deposit_orders").insert({
    business_id: businessId,
    order_id: orderId,
    amount: amt,
    currency: "KRW",
    status: "PENDING",
  });
  if (error) {
    console.error("[ads] create deposit failed", orderId, error);
    return { error: "충전 주문 생성에 실패했습니다." };
  }
  return {
    order: {
      orderId,
      orderName: `광고비 충전 ₩${amt.toLocaleString()}`,
      amount: amt,
      currency: "KRW",
      storeId,
      channelKey,
    },
  };
}

/** 충전 상태 동기화(멱등) — PortOne 재검증 후 금액 일치 시 PAID + 지갑 크레딧. */
export async function syncAdDeposit(
  orderId: string,
): Promise<{ status: string; error?: string }> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("ad_deposit_orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!order) return { status: "FAILED", error: "주문을 찾을 수 없습니다." };

  let remote;
  try {
    remote = await getPortonePayment(orderId);
  } catch {
    return { status: order.status, error: "결제 정보를 확인하지 못했습니다." };
  }
  const now = new Date().toISOString();

  if (remote.status === "PAID") {
    if (
      remote.amount?.total !== order.amount ||
      (remote.currency ?? "KRW") !== order.currency
    ) {
      await admin
        .from("ad_deposit_orders")
        .update({ status: "FAILED", updated_at: now })
        .eq("id", order.id)
        .eq("status", "PENDING");
      return { status: "FAILED", error: "결제 금액 검증에 실패했습니다." };
    }
    await admin
      .from("ad_deposit_orders")
      .update({
        status: "PAID",
        approved_at: now,
        updated_at: now,
        payment_key: remote.id,
      })
      .eq("id", order.id)
      .in("status", ["PENDING", "FAILED"]);
    // 지갑 크레딧(멱등). 결제 확정 직후.
    await creditDeposit({
      businessId: order.business_id,
      amount: order.amount,
      orderRowId: order.id,
    });
    return { status: "PAID" };
  }

  if (remote.status === "FAILED" || remote.status === "CANCELLED") {
    await admin
      .from("ad_deposit_orders")
      .update({ status: "FAILED", updated_at: now })
      .eq("id", order.id)
      .eq("status", "PENDING");
    return { status: "FAILED", error: "결제가 완료되지 않았습니다." };
  }
  return { status: order.status };
}
