import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { grantPartnerCredits } from "@/lib/partner";
import { BANK_ACCOUNT } from "@/lib/company";
import type { Buyer, CreatedOrder } from "@/lib/payments/orders";
import type { Database } from "@/types/database";

/**
 * 파트너 패킷(크레딧) 구매.
 * 1패킷 = 공급가 100원, 부가세 별도(10%) → 청구 110원/패킷. 최소 100패킷, 100단위.
 * 카드: product_orders(PortOne) → syncProductOrder → fulfillPacketOrderPaid (자동 지급).
 * 계좌이체: 청구서 발행 → 입금 → 관리자가 "입금 확인·지급"(수동) → 지급.
 * 지급은 granted_at 단일 전이로 멱등(원장은 추가만, 삭제·수정 없음).
 */
export const PACKET_UNIT_PRICE_KRW = 100;
export const PACKET_VAT_RATE = 0.1;
export const PACKET_MIN = 100;
export const PACKET_STEP = 100;
export const PACKET_MAX = 100_000;
export const PACKET_PRESETS = [100, 500, 1000, 3000] as const;

export type PacketOrderRow =
  Database["public"]["Tables"]["partner_packet_orders"]["Row"];

export interface PacketQuote {
  packets: number;
  unitPriceKrw: number;
  supplyKrw: number;
  vatKrw: number;
  totalKrw: number;
}

/** 수량 검증(최소·단위·최대). 통과하면 정수 수량, 아니면 에러 문구. */
export function validatePackets(
  raw: unknown,
): { ok: true; packets: number } | { ok: false; error: string } {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n))
    return { ok: false, error: "패킷 수량을 정수로 입력해주세요." };
  if (n < PACKET_MIN)
    return {
      ok: false,
      error: `최소 ${PACKET_MIN.toLocaleString()}패킷부터 구매할 수 있습니다.`,
    };
  if (n % PACKET_STEP !== 0)
    return { ok: false, error: `${PACKET_STEP}패킷 단위로 입력해주세요.` };
  if (n > PACKET_MAX)
    return {
      ok: false,
      error: `한 번에 최대 ${PACKET_MAX.toLocaleString()}패킷까지 구매할 수 있습니다.`,
    };
  return { ok: true, packets: n };
}

/** 공급가·부가세·합계. 부가세는 원 단위 반올림. */
export function quotePackets(packets: number): PacketQuote {
  const supplyKrw = packets * PACKET_UNIT_PRICE_KRW;
  const vatKrw = Math.round(supplyKrw * PACKET_VAT_RATE);
  return {
    packets,
    unitPriceKrw: PACKET_UNIT_PRICE_KRW,
    supplyKrw,
    vatKrw,
    totalKrw: supplyKrw + vatKrw,
  };
}

function invoiceNo(): string {
  const d = new Date();
  const ymd = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");
  const rand = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `PK-${ymd}-${rand}`;
}

export const PACKET_BANK = BANK_ACCOUNT;

/** 카드결제 주문 생성 — product_orders(PENDING) + 패킷 주문(pending). 금액은 서버 계산. */
export async function createPacketCardOrder(args: {
  partnerUserId: string;
  packets: number;
  buyer: Buyer;
}): Promise<{ order?: CreatedOrder; error?: string }> {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  if (!storeId || !channelKey || !process.env.PORTONE_API_SECRET)
    return {
      error: "카드결제 설정이 완료되지 않았습니다. 계좌이체를 이용해주세요.",
    };

  const q = quotePackets(args.packets);
  const orderId = `ord_${randomUUID()}`;
  const orderName = `STORYUP 패킷 ${q.packets.toLocaleString()}개`;
  const admin = createAdminClient();

  const { data: po, error: poErr } = await admin
    .from("partner_packet_orders")
    .insert({
      partner_user_id: args.partnerUserId,
      packets: q.packets,
      unit_price_krw: q.unitPriceKrw,
      supply_krw: q.supplyKrw,
      vat_krw: q.vatKrw,
      total_krw: q.totalKrw,
      method: "card",
      status: "pending",
      order_id: orderId,
      buyer_name: args.buyer.name || null,
      buyer_email: args.buyer.email || null,
      buyer_phone: args.buyer.phone || null,
    })
    .select("id")
    .single();
  if (poErr || !po) {
    console.error("[packets] packet order insert failed", poErr);
    return { error: "주문 생성에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  const { error } = await admin.from("product_orders").insert({
    order_id: orderId,
    product_id: null,
    product_name: orderName,
    amount: q.totalKrw,
    currency: "KRW",
    buyer_name: args.buyer.name || null,
    buyer_phone: args.buyer.phone || null,
    buyer_email: args.buyer.email || null,
    status: "PENDING",
    metadata: { packet_order_id: po.id },
  });
  if (error) {
    console.error("[packets] product order insert failed", orderId, error);
    await admin
      .from("partner_packet_orders")
      .update({ status: "cancelled", admin_note: "결제 주문 생성 실패" })
      .eq("id", po.id);
    return { error: "주문 생성에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  return {
    order: {
      orderId,
      orderName,
      amount: q.totalKrw,
      currency: "KRW",
      storeId,
      channelKey,
    },
  };
}

/**
 * 결제 완료(PAID) 이행 — syncProductOrder 가 metadata.packet_order_id 로 호출.
 * granted_at IS NULL 인 행만 전이시켜 멱등 보장. 원장 insert 는 전이 성공 시 1회.
 */
export async function fulfillPacketOrderPaid(
  packetOrderId: string,
  orderId: string,
): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("partner_packet_orders")
    .update({
      status: "paid",
      paid_at: now,
      granted_at: now,
      order_id: orderId,
    })
    .eq("id", packetOrderId)
    .is("granted_at", null)
    .select("partner_user_id, packets");
  if (error) {
    console.error("[packets] fulfill update failed", packetOrderId, error);
    return;
  }
  const row = rows?.[0];
  if (!row) return; // 이미 지급됨(멱등)
  await grantPartnerCredits(
    row.partner_user_id,
    row.packets,
    `패킷 구매(카드) ${orderId}`,
    null,
  );
}

/** 계좌이체 청구서 발행 — pending 주문 + 청구서 번호. 입금 확인은 관리자가 수동. */
export async function createPacketTransferOrder(args: {
  partnerUserId: string;
  packets: number;
  depositorName: string;
  buyer: Partial<Buyer>;
}): Promise<{ order?: PacketOrderRow; error?: string }> {
  const q = quotePackets(args.packets);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_packet_orders")
    .insert({
      partner_user_id: args.partnerUserId,
      packets: q.packets,
      unit_price_krw: q.unitPriceKrw,
      supply_krw: q.supplyKrw,
      vat_krw: q.vatKrw,
      total_krw: q.totalKrw,
      method: "transfer",
      status: "pending",
      invoice_no: invoiceNo(),
      depositor_name: args.depositorName,
      buyer_name: args.buyer.name || null,
      buyer_email: args.buyer.email || null,
      buyer_phone: args.buyer.phone || null,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[packets] transfer order insert failed", error);
    return { error: "청구서 발행에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }
  return { order: data };
}

/** 파트너 본인이 아직 입금 전인 계좌이체 주문을 취소. */
export async function cancelMyTransferOrder(
  partnerUserId: string,
  id: string,
): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_packet_orders")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("partner_user_id", partnerUserId)
    .eq("method", "transfer")
    .eq("status", "pending")
    .is("granted_at", null)
    .select("id");
  if (error) return { error: "취소에 실패했습니다." };
  if (!data?.length)
    return { error: "취소할 수 없는 주문입니다(이미 처리됨)." };
  return { ok: true };
}

/** 관리자: 계좌이체 입금 확인 → 패킷 지급(수동). granted_at 단일 전이로 멱등. */
export async function confirmPacketTransfer(
  id: string,
  adminUserId: string,
  note?: string,
): Promise<{ ok?: true; error?: string; packets?: number }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("partner_packet_orders")
    .update({
      status: "paid",
      paid_at: now,
      granted_at: now,
      reviewed_by: adminUserId,
      admin_note: note?.trim() || null,
    })
    .eq("id", id)
    .eq("method", "transfer")
    .eq("status", "pending")
    .is("granted_at", null)
    .select("partner_user_id, packets, invoice_no");
  if (error) return { error: "입금 확인 처리에 실패했습니다." };
  const row = rows?.[0];
  if (!row) return { error: "이미 처리됐거나 대기 중인 주문이 아닙니다." };
  await grantPartnerCredits(
    row.partner_user_id,
    row.packets,
    `패킷 구매(계좌이체) ${row.invoice_no ?? id}`,
    adminUserId,
  );
  return { ok: true, packets: row.packets };
}

/** 관리자: 대기 주문 취소(미입금·오발행). 지급된 주문은 취소 불가(원장 불변). */
export async function cancelPacketOrderAdmin(
  id: string,
  adminUserId: string,
  note?: string,
): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_packet_orders")
    .update({
      status: "cancelled",
      reviewed_by: adminUserId,
      admin_note: note?.trim() || null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .is("granted_at", null)
    .select("id");
  if (error) return { error: "취소에 실패했습니다." };
  if (!data?.length)
    return { error: "취소할 수 없는 주문입니다(이미 처리됨)." };
  return { ok: true };
}

export async function listMyPacketOrders(
  partnerUserId: string,
  limit = 30,
): Promise<PacketOrderRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_packet_orders")
    .select("*")
    .eq("partner_user_id", partnerUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export interface AdminPacketOrderRow extends PacketOrderRow {
  partnerEmail: string | null;
  partnerName: string | null;
}

/** 관리자: 전체 주문(계좌이체 대기 우선, 최신순). */
export async function listPacketOrdersAdmin(
  limit = 100,
): Promise<AdminPacketOrderRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_packet_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const ids = Array.from(new Set(rows.map((r) => r.partner_user_id)));
  const byId = new Map<string, { email: string | null; name: string | null }>();
  if (ids.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("user_id, email, name")
      .in("user_id", ids);
    for (const p of profs ?? [])
      byId.set(p.user_id, { email: p.email, name: p.name });
  }
  const isWait = (r: PacketOrderRow) =>
    r.status === "pending" && r.method === "transfer";
  return [...rows.filter(isWait), ...rows.filter((r) => !isWait(r))].map(
    (r) => ({
      ...r,
      partnerEmail: byId.get(r.partner_user_id)?.email ?? null,
      partnerName: byId.get(r.partner_user_id)?.name ?? null,
    }),
  );
}
