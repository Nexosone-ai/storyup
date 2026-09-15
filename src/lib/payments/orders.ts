import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { getPortonePayment } from "@/lib/payments/portone";
import {
  resolveActiveMarketerByCode,
  accrueProductCommission,
} from "@/lib/marketers";
import type { ProductRow, ProductOrderRow } from "@/types/database";

/**
 * PG 일반결제(1회성 상품 결제) 서비스.
 * 정기결제(billing.ts)와 분리된 독립 경로 — 포인트 적립은 없다.
 * 핵심 규칙:
 *  - 결제 금액·상품명은 항상 서버(products 테이블)가 결정한다. 브라우저 값은 신뢰하지 않는다.
 *  - 상태 전환은 PortOne API로 재검증한 뒤에만 이뤄지며, 상태 가드로 멱등하다.
 */

export interface Buyer {
  name: string;
  phone: string;
  email: string;
}

export interface CreatedOrder {
  orderId: string; // = PortOne paymentId (ord_…)
  orderName: string;
  amount: number;
  currency: "KRW";
  storeId: string;
  channelKey: string;
}

/** 공개 결제 페이지용 — 활성 상품만 slug로 조회 (service role, 안전 필드만). */
export async function getActiveProductBySlug(
  slug: string,
): Promise<ProductRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return data ?? null;
}

/** 공개 스토어용 — 판매중(활성) 상품 목록. */
export async function listActiveProducts(): Promise<ProductRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * 주문 생성 — 결제창을 열기 직전에 서버가 PENDING 주문을 만든다.
 * 금액/상품명은 DB의 활성 상품에서 가져와 스냅샷으로 고정한다.
 */
export async function createProductOrder(args: {
  productId: string;
  buyer: Buyer;
  refCode?: string | null;
}): Promise<{ order?: CreatedOrder; error?: string }> {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  // 상품 단건 결제는 '일반결제' 채널을 쓴다 (정기결제/빌링 채널과 별개).
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  if (!storeId || !channelKey || !process.env.PORTONE_API_SECRET)
    return { error: "결제 설정이 완료되지 않았습니다. 잠시 후 다시 시도해주세요." };

  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("*")
    .eq("id", args.productId)
    .eq("active", true)
    .maybeSingle();
  if (!product) return { error: "판매 중인 상품이 아닙니다." };

  // 마케터 귀속 — 결제링크의 ?ref=코드가 활성 마케터면 주문에 연결
  const refMarketerId = args.refCode
    ? await resolveActiveMarketerByCode(args.refCode)
    : null;

  const orderId = `ord_${randomUUID()}`;
  const { error } = await admin.from("product_orders").insert({
    order_id: orderId,
    product_id: product.id,
    product_name: product.name,
    amount: product.price,
    currency: "KRW",
    buyer_name: args.buyer.name || null,
    buyer_phone: args.buyer.phone || null,
    buyer_email: args.buyer.email || null,
    ref_marketer_id: refMarketerId,
    status: "PENDING",
  });
  if (error) {
    console.error("[orders] create failed", orderId, error);
    return { error: "주문 생성에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  return {
    order: {
      orderId,
      orderName: product.name,
      amount: product.price,
      currency: "KRW",
      storeId,
      channelKey,
    },
  };
}

export interface OrderSyncResult {
  status: ProductOrderRow["status"];
  amount?: number;
  productName?: string;
  error?: string;
}

/**
 * 주문 상태 동기화 (멱등). 결과 페이지와 웹훅이 모두 사용한다.
 * PortOne API로 재검증 후 금액·통화가 일치할 때만 PAID로 전환한다.
 */
export async function syncProductOrder(
  orderId: string,
): Promise<OrderSyncResult> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("product_orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!order)
    return { status: "FAILED", error: "주문을 찾을 수 없습니다." };

  let remote;
  try {
    remote = await getPortonePayment(orderId);
  } catch (err) {
    console.error("[orders] provider lookup failed", orderId, err);
    return {
      status: order.status,
      productName: order.product_name,
      amount: order.amount,
      error: "결제 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  const now = new Date().toISOString();

  if (remote.status === "PAID") {
    // 서버 측 검증: 금액·통화 일치
    const paidTotal = remote.amount?.total;
    if (paidTotal !== order.amount || (remote.currency ?? "KRW") !== order.currency) {
      await admin
        .from("product_orders")
        .update({
          status: "FAILED",
          updated_at: now,
          metadata: {
            ...(order.metadata as object | null),
            verification_error: "AMOUNT_MISMATCH",
            remote_amount: paidTotal ?? null,
            remote_currency: remote.currency ?? null,
          },
        })
        .eq("id", order.id)
        .eq("status", "PENDING");
      console.error("[orders] amount mismatch", orderId, order.amount, paidTotal);
      return {
        status: "FAILED",
        productName: order.product_name,
        amount: order.amount,
        error: "결제 금액 검증에 실패했습니다.",
      };
    }

    await admin
      .from("product_orders")
      .update({
        status: "PAID",
        approved_at: now,
        updated_at: now,
        payment_key: remote.id,
        transaction_id: remote.transactionId ?? null,
        payment_method: remote.method?.type ?? "CARD",
      })
      .eq("id", order.id)
      .in("status", ["PENDING", "FAILED"]);

    // 마케터 수당 적립 (product_order_id 유니크로 멱등). 실패는 결제에 영향 없음.
    await accrueProductCommission(orderId);

    return { status: "PAID", productName: order.product_name, amount: order.amount };
  }

  if (remote.status === "CANCELLED" || remote.status === "PARTIAL_CANCELLED") {
    const full = remote.status === "CANCELLED";
    await admin
      .from("product_orders")
      .update({
        status: full ? "CANCELLED" : "PARTIALLY_CANCELLED",
        cancelled_at: now,
        updated_at: now,
      })
      .eq("id", order.id);
    return {
      status: full ? "CANCELLED" : "PARTIALLY_CANCELLED",
      productName: order.product_name,
      amount: order.amount,
    };
  }

  if (remote.status === "FAILED") {
    await admin
      .from("product_orders")
      .update({ status: "FAILED", updated_at: now })
      .eq("id", order.id)
      .eq("status", "PENDING");
    return {
      status: "FAILED",
      productName: order.product_name,
      amount: order.amount,
      error: "결제가 실패했습니다.",
    };
  }

  // READY / PAY_PENDING 등 — 아직 결과 아님
  return {
    status: order.status,
    productName: order.product_name,
    amount: order.amount,
    error: "결제가 아직 완료되지 않았습니다.",
  };
}

// ---------------- 관리자 조회 ----------------

/** 관리자 화면 전용 — 호출 전 반드시 admin 확인. */
export async function listProductsAdmin(): Promise<ProductRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listProductOrdersAdmin(
  limit = 100,
): Promise<ProductOrderRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("product_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
