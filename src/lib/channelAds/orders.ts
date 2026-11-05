import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { computePartnerSettlement } from "@/lib/b2b2c/config";
import { CHANNEL_SHARE_FEE_RATE, SHARE_PLATFORM_LABELS, type SharePlatform } from "./config";
import { getChannelById } from "./channels";
import { resolveShareContent } from "./content";

export interface ShareBuyer {
  name?: string;
  phone?: string;
  email?: string;
}

export interface CreatedShareOrder {
  orderId: string;
  orderName: string;
  amount: number;
  currency: "KRW";
  storeId: string;
  channelKey: string;
}

/**
 * 채널 공유 의뢰 결제 주문 생성 — 금액은 서버가 채널 단가로 확정한다(브라우저 신뢰 금지).
 * share_orders(pending_payment) + product_orders(PENDING, metadata.share_order_id) 생성.
 * 결제 확정은 syncProductOrder → fulfillChannelSharePaid(멱등)에서 처리.
 */
export async function createChannelShareOrder(args: {
  advertiserUserId: string;
  channelId: string;
  contentType: "blog" | "card_news";
  contentRefId: string;
  message?: string | null;
  buyer: ShareBuyer;
}): Promise<{ order?: CreatedShareOrder; error?: string }> {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  if (!storeId || !channelKey || !process.env.PORTONE_API_SECRET)
    return { error: "결제 설정이 완료되지 않았습니다. 잠시 후 다시 시도해주세요." };

  const channel = await getChannelById(args.channelId);
  if (!channel || channel.status !== "active")
    return { error: "현재 의뢰할 수 없는 채널입니다." };
  if (channel.user_id === args.advertiserUserId)
    return { error: "본인 채널에는 의뢰할 수 없습니다." };

  // 콘텐츠 소유·공개 검증(서버 신뢰) — URL·제목을 서버가 확정.
  const content = await resolveShareContent(
    args.advertiserUserId,
    args.contentType,
    args.contentRefId,
  );
  if (!content)
    return { error: "공유할 내 콘텐츠를 찾을 수 없습니다. (발행된 글/카드만 가능)" };

  const admin = createAdminClient();
  const price = channel.price_krw;
  const platformLabel =
    SHARE_PLATFORM_LABELS[channel.platform as SharePlatform] ?? channel.platform;
  const orderName = `채널 공유 · ${platformLabel}`;

  const { data: shareOrder, error: soErr } = await admin
    .from("share_orders")
    .insert({
      advertiser_user_id: args.advertiserUserId,
      channel_id: channel.id,
      channel_owner_user_id: channel.user_id,
      platform: channel.platform,
      price_krw: price,
      content_type: args.contentType,
      content_ref_id: args.contentRefId,
      content_url: content.url,
      content_title: content.title,
      message: args.message?.trim() || null,
      status: "pending_payment",
    })
    .select("id")
    .single();
  if (soErr || !shareOrder) {
    console.error("[channel-ads] share order insert failed", soErr);
    return { error: "의뢰 생성에 실패했습니다." };
  }

  const orderId = `ord_${randomUUID()}`;
  const { error: poErr } = await admin.from("product_orders").insert({
    order_id: orderId,
    product_id: null,
    product_name: orderName,
    amount: price,
    currency: "KRW",
    buyer_name: args.buyer.name || null,
    buyer_phone: args.buyer.phone || null,
    buyer_email: args.buyer.email || null,
    status: "PENDING",
    metadata: { share_order_id: shareOrder.id },
  });
  if (poErr) {
    console.error("[channel-ads] product order insert failed", orderId, poErr);
    return { error: "주문 생성에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }
  await admin
    .from("share_orders")
    .update({ order_id: orderId, updated_at: new Date().toISOString() })
    .eq("id", shareOrder.id);

  return {
    order: { orderId, orderName, amount: price, currency: "KRW", storeId, channelKey },
  };
}

/**
 * 결제 완료 이행 — syncProductOrder(PAID 검증 후)에서 호출. 멱등.
 * 멱등 잠금 = share_earnings(share_order_id 유니크) 삽입 성공자만 1회 이행한다.
 *  1) 정산 원장 적립(held/에스크로) — net = 결제액 × 0.8(수수료 20%).
 *  2) share_orders 를 paid 로 전환(채널 보유자에게 작업 노출).
 * 실제 송금은 하지 않는다(상태·기록만). 확정·정산 해제는 PR C에서.
 */
export async function fulfillChannelSharePaid(
  shareOrderId: string,
  orderId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: so } = await admin
    .from("share_orders")
    .select("*")
    .eq("id", shareOrderId)
    .maybeSingle();
  if (!so) return;
  if (so.status !== "pending_payment") return; // 빠른 멱등 경로

  const gross = so.price_krw;
  const { netKrw } = computePartnerSettlement(gross, 0, CHANNEL_SHARE_FEE_RATE);
  const fee = Math.max(0, gross - netKrw);

  // 멱등 잠금: share_order_id 유니크. 선점 실패(23505)면 타 처리가 소유 → 종료.
  const { error: lockErr } = await admin.from("share_earnings").insert({
    channel_owner_user_id: so.channel_owner_user_id,
    share_order_id: so.id,
    gross_krw: gross,
    fee_krw: fee,
    net_krw: netKrw,
    status: "held",
  });
  if (lockErr) {
    if (lockErr.code === "23505") return; // 이미 처리됨/처리중
    console.error("[channel-ads] earning insert failed", shareOrderId, lockErr);
    return;
  }

  await admin
    .from("share_orders")
    .update({
      status: "paid",
      order_id: orderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", so.id)
    .eq("status", "pending_payment");
}
