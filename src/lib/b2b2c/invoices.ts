import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { secureToken, invoiceNumber } from "./secure";
import { computePartnerSettlement } from "./config";
import {
  parseEntitlementItems,
  type EntitlementItem,
} from "@/lib/partner/entitlementCatalog";
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

/**
 * 청구서에 동결되는 상품 스냅샷. basePlan = 결제 시 고객에게 주는 플랜(basic|pro|lite|null),
 * entitlements = 결제 시 판매 파트너에게 지급할 작업권(0112). 발행 후 상품 변경과 무관.
 */
export interface ProductSnapshot {
  name: string;
  includedServices: string | null;
  basePlan: string | null;
  basePlanVersion: string | null;
  productId?: string;
  hqProductId?: string | null;
  grantDays?: number;
  entitlements?: EntitlementItem[];
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
    hqProductId: offer.hq_product_id ?? null,
    grantDays: offer.grant_days ?? 30,
    entitlements: parseEntitlementItems(offer.entitlements),
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
      hq_product_id: offer.hq_product_id ?? null,
      sell_price_krw: offer.sell_price_krw,
      base_price_krw: offer.base_price_krw,
      parent_partner_user_id: offer.parent_partner_user_id,
      parent_base_price_krw: offer.parent_base_price_krw,
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

/**
 * 셀프서비스 구매 — 공개 스토어프론트에서 고객이 '활성' 상품을 직접 구매할 때 청구서를 발행한다.
 * 파트너의 수동 오퍼 없이 상품 스냅샷을 동결해 발행하며, client_user_id 를 구매 고객 본인으로
 * 지정한다(결제 완료 시 이 계정에 플랜이 부여됨 — fulfillInvoicePaid). 호출 전 고객 로그인 필수.
 * 상품은 'active' + 스토어프론트 'active' 만. 같은 고객·상품의 미결제 청구서가 있으면 재사용(중복 방지).
 */
export async function issueInvoiceFromProduct(
  clientUserId: string,
  productId: string,
): Promise<{ token?: string; error?: string }> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("partner_products")
    .select("*")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();
  if (!product) return { error: "판매 중인 상품이 아닙니다." };

  // 스토어프론트가 공개(active)인 파트너의 상품만 셀프 구매 허용.
  const { data: store } = await admin
    .from("partner_storefronts")
    .select("display_name, seller_info, status")
    .eq("partner_user_id", product.partner_user_id)
    .maybeSingle();
  if (!store || store.status !== "active")
    return { error: "현재 구매할 수 없는 상품입니다." };

  // 같은 고객·같은 상품의 미결제 청구서가 있으면 재사용(클릭마다 중복 발행 방지).
  const { data: existing } = await admin
    .from("partner_invoices")
    .select("token, product_snapshot")
    .eq("client_user_id", clientUserId)
    .eq("partner_user_id", product.partner_user_id)
    .in("status", ["issued", "pending_payment"])
    .order("created_at", { ascending: false })
    .limit(20);
  const reuse = (existing ?? []).find(
    (r) =>
      (r.product_snapshot as { productId?: string } | null)?.productId ===
      productId,
  );
  if (reuse) return { token: reuse.token };

  const snapshot: ProductSnapshot & { productId: string } = {
    name: product.name,
    includedServices: product.included_services,
    basePlan: product.base_plan,
    basePlanVersion: product.base_plan_version,
    productId: product.id,
    hqProductId: product.hq_product_id ?? null,
    grantDays: product.grant_days ?? 30,
    entitlements: parseEntitlementItems(product.entitlements),
  };

  const { data, error } = await admin
    .from("partner_invoices")
    .insert({
      offer_id: null,
      partner_user_id: product.partner_user_id,
      client_user_id: clientUserId,
      token: secureToken(),
      number: invoiceNumber(),
      product_snapshot: snapshot as unknown as Json,
      sell_price_krw: product.sell_price_krw,
      base_price_krw: product.base_price_krw,
      parent_partner_user_id: product.parent_partner_user_id,
      parent_base_price_krw: product.parent_base_price_krw,
      tax_krw: 0,
      currency: product.currency,
      vat_mode: product.vat_mode,
      billing_type: product.billing_type,
      billing_period: product.billing_period,
      seller_name: store.display_name,
      seller_info: store.seller_info,
      status: "issued",
    })
    .select("id, token, sell_price_krw")
    .single();
  if (error || !data) {
    console.error("[b2b2c] self-serve invoice failed", error);
    return { error: "구매 요청 생성에 실패했습니다." };
  }
  await admin.from("partner_invoice_events").insert({
    invoice_id: data.id,
    from_status: null,
    to_status: "issued",
    amount_krw: data.sell_price_krw,
    actor_id: clientUserId,
    note: "셀프서비스 구매 — 청구서 발행",
  });
  return { token: data.token };
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
 *  2) 스냅샷의 작업권을 판매 파트너에게 지급 + 플랜(basic/pro/lite)을 고객 계정에 부여(강등 금지)
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

  // --- 멱등 잠금 + 정산 적립 ---
  // 유니크 (invoice_id, partner_user_id). 판매자(파트너/서브파트너) 행을 먼저 넣어 잠근다.
  // 선점 실패(23505)면 타 처리가 소유 → 종료. 수수료액은 파생값(마진 − amount_krw).
  //
  // 2단계(일반 파트너): 판매자 = 파트너, base = 본사 공급가.
  // 3단계(서브파트너 판매): 판매자 = 서브파트너, base = 상위파트너 판매가(inv.base_price_krw).
  //   추가로 상위파트너 정산행(gross = 상위 판매가, base = 본사 공급가 = parent_base_price_krw)을
  //   더 넣는다. 본사는 본사 공급가 + 양측 수수료를 가져간다(파생 계산, 별도 행 없음).
  const gross = inv.sell_price_krw;
  const isSubSale = !!inv.parent_partner_user_id;
  const sellerRole = isSubSale ? "sub_partner" : "partner";

  const seller = computePartnerSettlement(gross, inv.base_price_krw);
  const { error: lockErr } = await admin.from("partner_earnings").insert({
    partner_user_id: inv.partner_user_id,
    invoice_id: inv.id,
    quote_id: null,
    gross_krw: gross,
    base_deduction_krw: seller.baseDeductionKrw,
    pg_fee_krw: 0,
    tax_krw: 0,
    amount_krw: seller.netKrw,
    beneficiary_role: sellerRole,
    status: "pending",
  });
  if (lockErr) {
    if (lockErr.code === "23505") return; // 이미 처리됨/처리중
    console.error("[b2b2c] settlement insert failed", invoiceId, lockErr);
    return;
  }

  // 서브파트너 판매면 상위파트너 정산행 추가(멱등 — 재시도는 위 잠금에서 이미 차단됨).
  if (isSubSale && inv.parent_partner_user_id) {
    const parentGross = inv.base_price_krw; // 상위파트너에게 올라가는 금액 = 상위 판매가
    const parentBase = inv.parent_base_price_krw ?? 0; // 본사 공급가
    const parent = computePartnerSettlement(parentGross, parentBase);
    const { error: parentErr } = await admin.from("partner_earnings").insert({
      partner_user_id: inv.parent_partner_user_id,
      invoice_id: inv.id,
      quote_id: null,
      gross_krw: parentGross,
      base_deduction_krw: parent.baseDeductionKrw,
      pg_fee_krw: 0,
      tax_krw: 0,
      amount_krw: parent.netKrw,
      beneficiary_role: "partner",
      status: "pending",
    });
    if (parentErr && parentErr.code !== "23505")
      console.error("[b2b2c] parent settlement insert failed", invoiceId, parentErr);
  }

  // --- 이행: 작업권 지급(판매 파트너) + 고객 플랜 부여(상위 플랜 강등 금지) — 멱등 ---
  const fulfillment = await applyInvoiceFulfillment(admin, inv, buyerEmail ?? null);
  const activation = `${fulfillment.activation} · 작업권 ${fulfillment.entitlements}`;

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
    .limit(1)
    .maybeSingle();
  if (!earning) return { ok: false, note: "결제 확정 전(정산 없음)" };

  let buyerEmail: string | null = null;
  if (inv.order_id) {
    const { data: order } = await admin
      .from("product_orders")
      .select("buyer_email")
      .eq("order_id", inv.order_id)
      .maybeSingle();
    buyerEmail = order?.buyer_email ?? null;
  }

  const fulfillment = await applyInvoiceFulfillment(admin, inv, buyerEmail);
  const activation = `${fulfillment.activation} · 작업권 ${fulfillment.entitlements}`;

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
  const failed =
    fulfillment.activation.startsWith("grant_failed") ||
    fulfillment.entitlements.startsWith("grant_failed");
  return { ok: !failed, note: activation };
}

/** 플랜 등급 — 결제 이행 시 활성 상위 플랜을 하위 상품으로 덮어쓰지 않기 위한 순서. partner 는 별도(절대 변경 안 함). */
const PLAN_RANK: Record<string, number> = { free: 0, lite: 1, basic: 2, pro: 3 };

type AdminDb = ReturnType<typeof createAdminClient>;

/** 청구서의 고객 계정 — 청구서 client_user_id, 없으면 결제자 이메일로 프로필 조회. */
async function resolveClientUserId(
  admin: AdminDb,
  inv: InvoiceRow,
  buyerEmail: string | null,
): Promise<string | null> {
  if (inv.client_user_id) return inv.client_user_id;
  if (!buyerEmail) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", buyerEmail.trim())
    .maybeSingle();
  return profile?.user_id ?? null;
}

/**
 * 결제 이행(멱등) — fulfillInvoicePaid / reprocessInvoice 공용.
 * 1) 작업권: 스냅샷 entitlements 를 청구서 판매자(서브 판매면 서브)에게 지급.
 *    부분 유니크 인덱스(ref_invoice_id, partner, service)가 1회만 허용 — 23505 는 '이미 지급'.
 * 2) 플랜: basic/pro/lite 를 고객 계정에 부여. partner 계정은 절대 변경 안 함, 활성 상위 플랜이면 유지(kept),
 *    기존 행은 update(billing_key 보존), 없을 때만 insert.
 */
async function applyInvoiceFulfillment(
  admin: AdminDb,
  inv: InvoiceRow,
  buyerEmail: string | null,
): Promise<{ activation: string; entitlements: string }> {
  const snap = (inv.product_snapshot ?? {}) as Partial<ProductSnapshot>;

  // 1) 작업권 지급
  const items = parseEntitlementItems(snap.entitlements);
  let entitlements = "none";
  if (items.length > 0) {
    const granted: string[] = [];
    let failed = false;
    for (const it of items) {
      const { error } = await admin.from("partner_entitlements").insert({
        partner_user_id: inv.partner_user_id,
        service_key: it.serviceKey,
        delta: it.units,
        reason: `invoice:${inv.number}`,
        ref_type: "invoice_grant",
        ref_invoice_id: inv.id,
      });
      if (!error) granted.push(`${it.serviceKey}×${it.units}`);
      else if (error.code === "23505") granted.push(`${it.serviceKey}(already)`);
      else {
        failed = true;
        console.error("[b2b2c] entitlement grant failed", inv.id, it.serviceKey, error.message);
      }
    }
    entitlements = (failed ? "grant_failed " : "granted ") + granted.join(",");
  }

  // 2) 고객 플랜 부여
  let activation = "no_plan";
  const plan = snap.basePlan;
  if (plan === "basic" || plan === "pro" || plan === "lite") {
    const clientUserId = await resolveClientUserId(admin, inv, buyerEmail);
    if (!clientUserId) {
      activation = "no_account";
    } else {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("plan, status, current_period_end")
        .eq("user_id", clientUserId)
        .maybeSingle();
      const nowMs = Date.now();
      const endMs = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
      const activeExisting =
        !!sub && sub.status === "active" && (!sub.current_period_end || endMs > nowMs);
      const days = invoicePeriodDays(inv, snap.grantDays);
      if (sub?.plan === "partner") {
        activation = "skipped:partner_account";
      } else if (activeExisting && (PLAN_RANK[sub!.plan] ?? 0) > PLAN_RANK[plan]) {
        activation = `kept:${sub!.plan}`;
      } else {
        const base = endMs > nowMs ? endMs : nowMs;
        const end = new Date(base + days * 86_400_000).toISOString();
        const patch = {
          plan,
          status: "active",
          current_period_end: end,
          trial: false,
          cancel_at_period_end: false,
          billing_failures: 0,
          updated_at: new Date().toISOString(),
        };
        const { error } = sub
          ? await admin.from("subscriptions").update(patch).eq("user_id", clientUserId)
          : await admin
              .from("subscriptions")
              .insert({ user_id: clientUserId, billing_key: null, ...patch });
        activation = error ? "grant_failed" : `granted:${plan}:${days}d`;
      }
      // 청구서에 고객을 연결(향후 조회).
      if (!inv.client_user_id)
        await admin
          .from("partner_invoices")
          .update({ client_user_id: clientUserId })
          .eq("id", inv.id);
    }
  }
  return { activation, entitlements };
}

/** 청구 기간(일). period_start~end가 있으면 그 길이, 없으면 스냅샷 grantDays(기본 30일). */
function invoicePeriodDays(inv: InvoiceRow, fallbackDays?: number): number {
  if (inv.period_start && inv.period_end) {
    const ms =
      new Date(inv.period_end).getTime() - new Date(inv.period_start).getTime();
    const days = Math.round(ms / 86_400_000);
    if (days > 0) return days;
  }
  const fb = Math.floor(fallbackDays ?? 30);
  return fb > 0 ? fb : 30;
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
