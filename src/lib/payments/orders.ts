import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { getPortonePayment } from "@/lib/payments/portone";
import {
  resolveSellerByCode,
  accrueProductCommission,
} from "@/lib/network";
import { settleQuotePaid } from "@/lib/agency";
import type { PlanId } from "@/lib/plans";
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
    ? await resolveSellerByCode(args.refCode)
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

/**
 * 파트너 견적(결제코드) 주문 생성 — 금액은 서버가 견적(agency_quotes)에서 확정한다.
 * product_id는 null(상품 없음), metadata.quote_id로 결제 후 정산을 연결한다.
 */
export async function createQuoteOrder(args: {
  code: string;
  buyer: Buyer;
}): Promise<{ order?: CreatedOrder; error?: string }> {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  if (!storeId || !channelKey || !process.env.PORTONE_API_SECRET)
    return { error: "결제 설정이 완료되지 않았습니다. 잠시 후 다시 시도해주세요." };

  const admin = createAdminClient();
  const { data: quote } = await admin
    .from("agency_quotes")
    .select("id, service_key, client_price_krw, status")
    .eq("code", args.code)
    .maybeSingle();
  if (!quote) return { error: "결제 정보를 찾을 수 없습니다." };
  if (quote.status === "paid") return { error: "이미 결제된 건입니다." };
  if (quote.status === "cancelled" || quote.status === "expired")
    return { error: "만료되었거나 취소된 결제 코드입니다." };

  const { data: svc } = await admin
    .from("agency_services")
    .select("label")
    .eq("key", quote.service_key)
    .maybeSingle();
  const orderName = svc?.label ?? "대행 서비스";

  const orderId = `ord_${randomUUID()}`;
  const { error } = await admin.from("product_orders").insert({
    order_id: orderId,
    product_id: null,
    product_name: orderName,
    amount: quote.client_price_krw,
    currency: "KRW",
    buyer_name: args.buyer.name || null,
    buyer_phone: args.buyer.phone || null,
    buyer_email: args.buyer.email || null,
    status: "PENDING",
    metadata: { quote_id: quote.id },
  });
  if (error) {
    console.error("[orders] create quote order failed", orderId, error);
    return { error: "주문 생성에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }
  return {
    order: {
      orderId,
      orderName,
      amount: quote.client_price_krw,
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
    // 자동 이행 — 상품에 지급 플랜이 연결돼 있으면 구매자 계정에 플랜 부여 (멱등).
    await fulfillProductOrder(orderId);
    // 대행 견적 결제면 정산(공급가 보유·파트너 마진 적립, 멱등).
    const quoteId = (order.metadata as Record<string, unknown> | null)?.quote_id;
    if (typeof quoteId === "string") await settleQuotePaid(quoteId, orderId);

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

// ---------------- 결제 자동 이행 (fulfillment) ----------------

const GRANTABLE_PLANS = new Set(["basic", "pro"]);

/**
 * 상품 결제 자동 이행 — 상품에 grants_plan이 설정돼 있으면,
 * 구매자 이메일과 일치하는 계정에 해당 플랜을 grant_days만큼 부여(기존 기간이면 연장).
 * 계정을 못 찾으면 지급하지 않고 사유만 기록(관리자 수동 처리). 멱등(fulfilled 플래그).
 */
export async function fulfillProductOrder(orderId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("product_orders")
      .select("id, status, product_id, buyer_email, metadata")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!order || order.status !== "PAID" || !order.product_id) return;
    const meta = (order.metadata as Record<string, unknown> | null) ?? {};
    if (meta.fulfilled) return; // 이미 이행됨

    const { data: product } = await admin
      .from("products")
      .select("grants_plan, grant_days, grants_video_credits, grants_template_version")
      .eq("id", order.product_id)
      .maybeSingle();

    // 디자이너 템플릿 판매 — 소유권 기록 + 디자이너 정산 적립(멱등). 플랜/영상과 독립.
    if (product?.grants_template_version) {
      const { fulfillTemplateOrder } = await import("@/lib/marketplace/sales");
      let tresult = "no_listing";
      try {
        const done = await fulfillTemplateOrder(orderId, product.grants_template_version);
        tresult = done ? "granted" : "no_listing";
      } catch (err) {
        console.error("[orders] template fulfill failed", orderId, err);
        tresult = "error";
      }
      await admin
        .from("product_orders")
        .update({
          metadata: { ...meta, fulfilled: true, fulfillment: `template_${tresult}` },
        })
        .eq("id", order.id);
      return;
    }

    // 영상 팩(레거시) — 영상 생성이 UP 과금으로 바뀌어, 지급도 '영상 크레딧'이 아니라
    // 'UP'으로 한다(1편 = AI_VIDEO 단가). 멱등(meta.fulfilled)로 중복 지급 방지.
    if (product?.grants_video_credits && product.grants_video_credits > 0) {
      const email = (order.buyer_email ?? "").trim();
      let vresult = "no_account";
      if (email) {
        const { data: profile } = await admin
          .from("profiles")
          .select("user_id")
          .eq("email", email)
          .maybeSingle();
        if (profile) {
          const { getServicePrice } = await import("@/lib/payments/prices");
          const perVideo = await getServicePrice("AI_VIDEO");
          const unit = perVideo > 0 ? perVideo : 1000;
          const up = product.grants_video_credits * unit;
          const { error: grantErr } = await admin.from("point_transactions").insert({
            user_id: profile.user_id,
            amount: up,
            reason: `AI 영상 팩(${product.grants_video_credits}편) — UP 지급`,
            type: "PURCHASE",
            ref_type: "video_pack",
          });
          if (grantErr)
            console.error("[orders] video pack UP grant failed", orderId, grantErr);
          vresult = `up:${up}`;
        }
      }
      await admin
        .from("product_orders")
        .update({
          metadata: { ...meta, fulfilled: true, fulfillment: `videopack_${vresult}` },
        })
        .eq("id", order.id);
      return;
    }

    // 지급 대상 상품이 아니면 아무 것도 하지 않는다 (플래그도 남기지 않음)
    if (!product?.grants_plan || !GRANTABLE_PLANS.has(product.grants_plan)) return;

    const plan = product.grants_plan as PlanId;
    const days = product.grant_days ?? 30;
    const email = (order.buyer_email ?? "").trim();

    let result: string;
    if (!email) {
      result = "no_email";
    } else {
      const { data: profile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();
      if (!profile) {
        result = "no_account";
      } else {
        // 기존 구독 기간이 남아 있으면 이어서 연장, 없으면 지금부터. 빌링키는 건드리지 않음.
        const { data: sub } = await admin
          .from("subscriptions")
          .select("current_period_end")
          .eq("user_id", profile.user_id)
          .maybeSingle();
        const now = Date.now();
        const baseMs =
          sub?.current_period_end &&
          new Date(sub.current_period_end).getTime() > now
            ? new Date(sub.current_period_end).getTime()
            : now;
        const end = new Date(baseMs + days * 86_400_000).toISOString();
        await admin.from("subscriptions").upsert(
          {
            user_id: profile.user_id,
            plan,
            status: "active",
            current_period_end: end,
            trial: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        result = `granted:${plan}`;
      }
    }

    await admin
      .from("product_orders")
      .update({
        metadata: {
          ...meta,
          fulfilled: true,
          fulfillment: result,
          fulfilled_at: new Date().toISOString(),
        },
      })
      .eq("id", order.id);
  } catch (err) {
    console.error("[orders] fulfill error", orderId, err);
  }
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
