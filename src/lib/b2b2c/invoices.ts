import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { secureToken, invoiceNumber } from "./secure";
import type { Database, Json } from "@/types/database";
import type { OfferRow } from "./offers";

export type InvoiceRow = Database["public"]["Tables"]["partner_invoices"]["Row"];

/** 고객(공개)용 청구서 뷰 — 기본요금·마진·정산정보 비노출. 최종 청구금액·조건만. */
export interface PublicInvoice {
  token: string;
  number: string;
  name: string;
  includedServices: string | null;
  sellPriceKrw: number;
  taxKrw: number;
  currency: string;
  vatMode: string;
  billingType: string;
  billingPeriod: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  sellerName: string | null;
  sellerInfo: string | null;
  collectorInfo: string;
  status: string;
  paidAt: string | null;
}

interface ProductSnapshot {
  name: string;
  includedServices: string | null;
  basePlan: string | null;
  basePlanVersion: string | null;
}

export function toPublicInvoice(r: InvoiceRow): PublicInvoice {
  const snap = (r.product_snapshot ?? {}) as Partial<ProductSnapshot>;
  return {
    token: r.token,
    number: r.number,
    name: snap.name ?? "",
    includedServices: snap.includedServices ?? null,
    sellPriceKrw: r.sell_price_krw,
    taxKrw: r.tax_krw,
    currency: r.currency,
    vatMode: r.vat_mode,
    billingType: r.billing_type,
    billingPeriod: r.billing_period,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    sellerName: r.seller_name,
    sellerInfo: r.seller_info,
    collectorInfo: r.collector_info,
    status: r.status,
    paidAt: r.paid_at,
  };
}

export async function listMyInvoices(
  partnerUserId: string,
): Promise<InvoiceRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_invoices")
    .select("*")
    .eq("partner_user_id", partnerUserId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** 고객 본인 청구서 목록(대시보드용). */
export async function listClientInvoices(
  clientUserId: string,
): Promise<InvoiceRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_invoices")
    .select("*")
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export interface IssueInvoiceInput {
  offerId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  taxKrw?: number | null;
  sellerName?: string | null;
  sellerInfo?: string | null;
}

/**
 * 오퍼 → 확정 청구서 발행(스냅샷 동결). 호출 전 isCurrentUserPartner 확인.
 * 발행 후에는 상품/오퍼 변경이 이 청구서에 영향을 주지 않는다. 상태 'issued'.
 */
export async function issueInvoiceFromOffer(
  partnerUserId: string,
  input: IssueInvoiceInput,
): Promise<{ invoice?: InvoiceRow; error?: string }> {
  const admin = createAdminClient();
  const { data: offer } = await admin
    .from("partner_offers")
    .select("*")
    .eq("id", input.offerId)
    .eq("partner_user_id", partnerUserId)
    .maybeSingle<OfferRow>();
  if (!offer) return { error: "오퍼를 찾을 수 없습니다." };

  const snapshot: ProductSnapshot = {
    name: offer.name,
    includedServices: offer.included_services,
    basePlan: offer.base_plan,
    basePlanVersion: offer.base_plan_version,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_invoices")
    .insert({
      offer_id: offer.id,
      partner_user_id: partnerUserId,
      client_user_id: offer.client_user_id,
      token: secureToken(),
      number: invoiceNumber(),
      product_snapshot: snapshot as unknown as Json,
      sell_price_krw: offer.sell_price_krw,
      base_price_krw: offer.base_price_krw,
      tax_krw: Math.max(0, Math.floor(input.taxKrw ?? 0)),
      currency: offer.currency,
      vat_mode: offer.vat_mode,
      billing_type: offer.billing_type,
      billing_period: offer.billing_period,
      period_start: input.periodStart ?? null,
      period_end: input.periodEnd ?? null,
      seller_name: input.sellerName ?? null,
      seller_info: input.sellerInfo ?? null,
      status: "issued",
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[b2b2c] invoice issue failed", error);
    return { error: "청구서 발행에 실패했습니다." };
  }
  await admin.from("partner_invoice_events").insert({
    invoice_id: data.id,
    from_status: null,
    to_status: "issued",
    amount_krw: data.sell_price_krw,
    actor_id: partnerUserId,
    note: "청구서 발행",
  });
  return { invoice: data };
}

/** 공개 토큰으로 청구서 조회(서비스롤). */
export async function getInvoiceByToken(
  token: string,
): Promise<InvoiceRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_invoices")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return data ?? null;
}

/**
 * 결제 완료 시 이행 — syncProductOrder(PAID 검증 후)에서 호출. 멱등.
 * 멱등 잠금 = partner_earnings(invoice_id 유니크) 삽입 성공자만 1회 이행한다.
 *  1) 정산 원장 적립(공급가=기본요금 공제, 차액=파트너 예상 정산액)
 *  2) 기본 요금제(basic/pro)를 고객 계정에 부여(한도·크레딧은 기존 정책 그대로)
 *  3) 청구서 paid 전환 + 이력 기록
 * 활성화(2)가 실패해도 결제/정산 기록은 남고, 관리자 reprocess로 안전 재처리한다.
 */
export async function fulfillInvoicePaid(
  invoiceId: string,
  orderId: string,
  buyerEmail?: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("partner_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return;
  if (inv.status === "paid") return; // 빠른 멱등 경로

  // --- 멱등 잠금: 청구서당 정산 1건(유니크). 선점 실패(23505)면 타 처리가 소유 → 종료.
  const gross = inv.sell_price_krw;
  // 공제는 실제 수납액을 넘지 않는다(판매가<기본요금 시 음수 정산 방지).
  const baseDeduction = Math.min(inv.base_price_krw, gross);
  const net = Math.max(0, gross - baseDeduction); // 예상 정산액(세금·PG수수료는 별도 조정항목, 기본 0)
  const { error: lockErr } = await admin.from("partner_earnings").insert({
    partner_user_id: inv.partner_user_id,
    invoice_id: inv.id,
    quote_id: null,
    gross_krw: gross,
    base_deduction_krw: baseDeduction,
    pg_fee_krw: 0,
    tax_krw: 0,
    amount_krw: net,
    status: "pending",
  });
  if (lockErr) {
    if (lockErr.code === "23505") return; // 이미 처리됨/처리중
    console.error("[b2b2c] settlement insert failed", invoiceId, lockErr);
    return;
  }

  // --- 기본 요금제 부여(고객 계정 확인 — 파트너/에이전트 권한은 부여하지 않는다) ---
  let activation = "no_plan";
  const basePlan = inv.base_price_krw >= 0 ? inferBasePlan(inv) : null;
  if (basePlan === "basic" || basePlan === "pro") {
    let clientUserId = inv.client_user_id;
    if (!clientUserId && buyerEmail) {
      const { data: profile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("email", buyerEmail.trim())
        .maybeSingle();
      clientUserId = profile?.user_id ?? null;
    }
    if (!clientUserId) {
      activation = "no_account";
    } else {
      const days = invoicePeriodDays(inv);
      const { data: sub } = await admin
        .from("subscriptions")
        .select("current_period_end")
        .eq("user_id", clientUserId)
        .maybeSingle();
      const nowMs = Date.now();
      const baseMs =
        sub?.current_period_end &&
        new Date(sub.current_period_end).getTime() > nowMs
          ? new Date(sub.current_period_end).getTime()
          : nowMs;
      const end = new Date(baseMs + days * 86_400_000).toISOString();
      const { error: grantErr } = await admin.from("subscriptions").upsert(
        {
          user_id: clientUserId,
          plan: basePlan,
          status: "active",
          current_period_end: end,
          trial: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      activation = grantErr ? "grant_failed" : `granted:${basePlan}`;
      // 청구서에 고객을 연결(향후 조회).
      if (!inv.client_user_id)
        await admin
          .from("partner_invoices")
          .update({ client_user_id: clientUserId })
          .eq("id", inv.id);
    }
  }

  // --- 청구서 paid 전환 + 이력 ---
  await admin
    .from("partner_invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      order_id: orderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inv.id);
  await admin.from("partner_invoice_events").insert({
    invoice_id: inv.id,
    from_status: inv.status,
    to_status: "paid",
    amount_krw: gross,
    note: `결제 완료 · 활성화 ${activation}`,
  });
}

/**
 * 결제는 성공(정산 적립 있음)했지만 활성화(플랜 부여)가 실패/누락된 청구서를 안전 재처리.
 * 관리자 전용. 정산 중복은 일어나지 않고(이미 적립됨), 플랜만 멱등 부여 후 paid로 맞춘다.
 */
export async function reprocessInvoice(
  invoiceId: string,
): Promise<{ ok: boolean; note: string }> {
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("partner_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, note: "청구서 없음" };
  // 정산(멱등 잠금)이 있어야 결제가 확정된 것. 없으면 아직 미결제.
  const { data: earning } = await admin
    .from("partner_earnings")
    .select("id")
    .eq("invoice_id", invoiceId)
    .maybeSingle();
  if (!earning) return { ok: false, note: "결제 확정 전(정산 없음)" };

  const basePlan = inferBasePlan(inv);
  let buyerEmail: string | null = null;
  if (inv.order_id) {
    const { data: order } = await admin
      .from("product_orders")
      .select("buyer_email")
      .eq("order_id", inv.order_id)
      .maybeSingle();
    buyerEmail = order?.buyer_email ?? null;
  }

  let activation = "no_plan";
  if (basePlan === "basic" || basePlan === "pro") {
    let clientUserId = inv.client_user_id;
    if (!clientUserId && buyerEmail) {
      const { data: profile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("email", buyerEmail.trim())
        .maybeSingle();
      clientUserId = profile?.user_id ?? null;
    }
    if (!clientUserId) activation = "no_account";
    else {
      const days = invoicePeriodDays(inv);
      const { data: sub } = await admin
        .from("subscriptions")
        .select("current_period_end")
        .eq("user_id", clientUserId)
        .maybeSingle();
      const nowMs = Date.now();
      const baseMs =
        sub?.current_period_end &&
        new Date(sub.current_period_end).getTime() > nowMs
          ? new Date(sub.current_period_end).getTime()
          : nowMs;
      const end = new Date(baseMs + days * 86_400_000).toISOString();
      const { error } = await admin.from("subscriptions").upsert(
        {
          user_id: clientUserId,
          plan: basePlan,
          status: "active",
          current_period_end: end,
          trial: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      activation = error ? "grant_failed" : `granted:${basePlan}`;
      if (!inv.client_user_id)
        await admin
          .from("partner_invoices")
          .update({ client_user_id: clientUserId })
          .eq("id", inv.id);
    }
  }

  if (inv.status !== "paid")
    await admin
      .from("partner_invoices")
      .update({ status: "paid", paid_at: inv.paid_at ?? new Date().toISOString() })
      .eq("id", inv.id);
  await admin.from("partner_invoice_events").insert({
    invoice_id: inv.id,
    from_status: inv.status,
    to_status: "paid",
    note: `관리자 재처리 · 활성화 ${activation}`,
  });
  return { ok: activation.startsWith("granted"), note: activation };
}

/** 청구서 스냅샷에서 기준 요금제 추출. */
function inferBasePlan(inv: InvoiceRow): string | null {
  const snap = (inv.product_snapshot ?? {}) as Partial<ProductSnapshot>;
  return snap.basePlan ?? null;
}

/** 청구 기간(일). period_start~end가 있으면 그 길이, 없으면 30일(월 1회분). */
function invoicePeriodDays(inv: InvoiceRow): number {
  if (inv.period_start && inv.period_end) {
    const ms =
      new Date(inv.period_end).getTime() - new Date(inv.period_start).getTime();
    const days = Math.round(ms / 86_400_000);
    if (days > 0) return days;
  }
  return 30;
}

/** 청구서 무효화(발행 후 미결제건만). 금융기록은 삭제하지 않고 상태+이력으로 남긴다. */
export async function voidInvoice(
  partnerUserId: string,
  id: string,
  note?: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("partner_invoices")
    .select("status, partner_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!inv || inv.partner_user_id !== partnerUserId)
    return { error: "청구서를 찾을 수 없습니다." };
  if (inv.status === "paid")
    return { error: "이미 결제된 청구서는 무효화할 수 없습니다." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_invoices")
    .update({ status: "void", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("partner_user_id", partnerUserId)
    .neq("status", "paid");
  if (error) return { error: "무효화에 실패했습니다." };
  await admin.from("partner_invoice_events").insert({
    invoice_id: id,
    from_status: inv.status,
    to_status: "void",
    actor_id: partnerUserId,
    note: note ?? "청구서 무효화",
  });
  return {};
}
