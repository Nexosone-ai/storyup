import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { InvoiceRow } from "./invoices";

/** 관리자용 청구/수납/정산 감사. 호출 전 반드시 isCurrentUserAdmin() 확인. */

export interface AdminInvoiceView {
  id: string;
  number: string;
  token: string;
  partnerLabel: string;
  clientLabel: string;
  sellPriceKrw: number;
  basePriceKrw: number;
  status: string;
  orderId: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminSettlementView {
  id: string;
  invoiceId: string | null;
  quoteId: string | null;
  partnerLabel: string;
  grossKrw: number | null;
  baseDeductionKrw: number | null;
  pgFeeKrw: number;
  taxKrw: number;
  amountKrw: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

async function emailMap(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("user_id, name, email")
    .in("user_id", ids);
  return new Map(
    (data ?? []).map((p) => [p.user_id, p.name || p.email || p.user_id.slice(0, 8)]),
  );
}

export async function listAllInvoices(limit = 200): Promise<AdminInvoiceView[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_invoices")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as InvoiceRow[];
  const labels = await emailMap(
    rows.flatMap((r) => [r.partner_user_id, r.client_user_id ?? ""]),
  );
  return rows.map((r) => {
    return {
      id: r.id,
      number: r.number,
      token: r.token,
      partnerLabel: labels.get(r.partner_user_id) ?? r.partner_user_id.slice(0, 8),
      clientLabel: r.client_user_id
        ? (labels.get(r.client_user_id) ?? r.client_user_id.slice(0, 8))
        : "미연결",
      sellPriceKrw: r.sell_price_krw,
      basePriceKrw: r.base_price_krw,
      status: r.status,
      orderId: r.order_id,
      createdAt: r.created_at,
      paidAt: r.paid_at,
    };
  });
}

export async function listSettlements(
  limit = 200,
): Promise<AdminSettlementView[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_earnings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const labels = await emailMap(rows.map((r) => r.partner_user_id));
  return rows.map((r) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    quoteId: r.quote_id,
    partnerLabel: labels.get(r.partner_user_id) ?? r.partner_user_id.slice(0, 8),
    grossKrw: r.gross_krw,
    baseDeductionKrw: r.base_deduction_krw,
    pgFeeKrw: r.pg_fee_krw,
    taxKrw: r.tax_krw,
    amountKrw: r.amount_krw,
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
  }));
}

export interface AdminB2b2cStats {
  invoices: Record<string, number>; // status → count
  grossPaid: number; // 결제 완료 청구 총액
  settlementPending: number;
  settlementHeld: number;
  settlementPaid: number;
}

export async function getB2b2cStats(): Promise<AdminB2b2cStats> {
  const admin = createAdminClient();
  const [{ data: invs }, { data: earns }] = await Promise.all([
    admin.from("partner_invoices").select("status, sell_price_krw"),
    admin.from("partner_earnings").select("status, amount_krw"),
  ]);
  const invoices: Record<string, number> = {};
  let grossPaid = 0;
  for (const i of invs ?? []) {
    invoices[i.status] = (invoices[i.status] ?? 0) + 1;
    if (i.status === "paid") grossPaid += i.sell_price_krw;
  }
  const s = { settlementPending: 0, settlementHeld: 0, settlementPaid: 0 };
  for (const e of earns ?? []) {
    if (e.status === "paid") s.settlementPaid += e.amount_krw;
    else if (e.status === "held") s.settlementHeld += e.amount_krw;
    else s.settlementPending += e.amount_krw;
  }
  return { invoices, grossPaid, ...s };
}

/** 정산 상태 변경(대기→보류/지급). 실제 송금은 하지 않는다(상태·기록만). */
export async function setEarningStatus(
  earningId: string,
  status: "pending" | "held" | "paid",
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("partner_earnings")
    .update({
      status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", earningId);
  if (error) return { error: "정산 상태 변경에 실패했습니다." };
  return {};
}
