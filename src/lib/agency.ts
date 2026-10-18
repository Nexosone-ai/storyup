import "server-only";
import { randomUUID } from "crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { partnerForClient } from "@/lib/partner";

/**
 * 대행 마켓플레이스 — 서포터즈 대행 문의(클라↔파트너 매칭·채팅) + 견적(공급가+마진→결제코드).
 * 결제는 플랫폼(PortOne)이 수금, 공급가는 STORYUP, 마진은 파트너 정산(partner_earnings).
 * 세션(RLS) 클라이언트를 기본으로 쓰고, 공개 결제·관리자 교차작업만 admin 클라이언트.
 */

export interface AgencyService {
  key: string;
  label: string;
  description: string | null;
  supplyPriceKrw: number;
  active: boolean;
}
export interface AgencyInquiry {
  id: string;
  businessId: string;
  clientUserId: string;
  partnerUserId: string | null;
  serviceKey: string;
  serviceLabel: string;
  message: string | null;
  status: string;
  createdAt: string;
}
export interface ThreadMessage {
  id: string;
  senderUserId: string;
  body: string;
  createdAt: string;
}
export interface QuoteByCode {
  id: string;
  code: string;
  serviceLabel: string;
  clientPriceKrw: number;
  status: string;
}

const SERVICE_LABELS: Record<string, string> = {
  BLOG_AGENCY: "블로그 대행",
  VIDEO_AGENCY: "영상제작 대행",
};

/** 활성 대행 서비스 + 공급가. */
export async function listAgencyServices(): Promise<AgencyService[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_services")
    .select("key, label, description, supply_price_krw, active")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((r) => ({
    key: r.key,
    label: r.label,
    description: r.description,
    supplyPriceKrw: r.supply_price_krw,
    active: r.active,
  }));
}

async function serviceLabel(key: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agency_services")
    .select("label")
    .eq("key", key)
    .maybeSingle();
  return data?.label ?? SERVICE_LABELS[key] ?? key;
}

/** 대행 문의 생성 — 배정 파트너 자동 매칭(없으면 null=관리자 배정 대기). 첫 메시지 기록. */
export async function createAgencyInquiry(args: {
  businessId: string;
  serviceKey: string;
  message: string;
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 사업장 소유자(=클라이언트) 확인 + owner_id.
  const { data: biz } = await supabase
    .from("businesses")
    .select("id, user_id")
    .eq("id", args.businessId)
    .maybeSingle();
  if (!biz) return { error: "사업장을 찾을 수 없습니다." };

  const partnerId = await partnerForClient(biz.user_id); // 기배정 파트너 자동
  const { data: inq, error } = await supabase
    .from("agency_inquiries")
    .insert({
      business_id: args.businessId,
      client_user_id: user.id,
      partner_user_id: partnerId,
      service_key: args.serviceKey,
      message: args.message.trim().slice(0, 2000) || null,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !inq) return { error: "문의 생성에 실패했습니다." };

  if (args.message.trim())
    await supabase.from("agency_messages").insert({
      inquiry_id: inq.id,
      sender_user_id: user.id,
      body: args.message.trim().slice(0, 2000),
    });
  return { id: inq.id };
}

async function decorate(
  rows: {
    id: string;
    business_id: string;
    client_user_id: string;
    partner_user_id: string | null;
    service_key: string;
    message: string | null;
    status: string;
    created_at: string;
  }[],
): Promise<AgencyInquiry[]> {
  return rows.map((r) => ({
    id: r.id,
    businessId: r.business_id,
    clientUserId: r.client_user_id,
    partnerUserId: r.partner_user_id,
    serviceKey: r.service_key,
    serviceLabel: SERVICE_LABELS[r.service_key] ?? r.service_key,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/** 내(클라이언트) 대행 문의 — RLS로 본인 사업장 것만. */
export async function listClientInquiries(): Promise<AgencyInquiry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_inquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return decorate(data ?? []);
}

/** 파트너에게 배정된 대행 문의. */
export async function listPartnerInquiries(
  partnerUserId: string,
): Promise<AgencyInquiry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_inquiries")
    .select("*")
    .eq("partner_user_id", partnerUserId)
    .order("created_at", { ascending: false })
    .limit(50);
  return decorate(data ?? []);
}

/** 문의 1건 + 스레드(RLS 참여자만). */
export async function loadThread(
  inquiryId: string,
): Promise<{ inquiry: AgencyInquiry | null; messages: ThreadMessage[] }> {
  const supabase = await createClient();
  const { data: inq } = await supabase
    .from("agency_inquiries")
    .select("*")
    .eq("id", inquiryId)
    .maybeSingle();
  if (!inq) return { inquiry: null, messages: [] };
  const { data: msgs } = await supabase
    .from("agency_messages")
    .select("id, sender_user_id, body, created_at")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });
  const [inquiry] = await decorate([inq]);
  return {
    inquiry,
    messages: (msgs ?? []).map((m) => ({
      id: m.id,
      senderUserId: m.sender_user_id,
      body: m.body,
      createdAt: m.created_at,
    })),
  };
}

/** 메시지 전송(참여자: 클라 소유자·배정 파트너·관리자). */
export async function sendAgencyMessage(
  inquiryId: string,
  body: string,
): Promise<{ ok?: boolean; error?: string }> {
  const text = body.trim().slice(0, 2000);
  if (!text) return { error: "메시지를 입력해주세요." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase.from("agency_messages").insert({
    inquiry_id: inquiryId,
    sender_user_id: user.id,
    body: text,
  });
  if (error) return { error: "전송에 실패했습니다(권한 확인)." };
  await supabase
    .from("agency_inquiries")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", inquiryId);
  return { ok: true };
}

/** 파트너 견적 발행 — 공급가 스냅샷 + 클라가격(공급가 이상) → 결제코드. 채팅에 링크 안내. */
export async function createQuote(args: {
  inquiryId: string;
  clientPriceKrw: number;
}): Promise<{ code?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: inq } = await supabase
    .from("agency_inquiries")
    .select("id, service_key, partner_user_id")
    .eq("id", args.inquiryId)
    .maybeSingle();
  if (!inq) return { error: "문의를 찾을 수 없습니다." };
  if (inq.partner_user_id !== user.id)
    return { error: "이 문의의 담당 파트너만 견적을 발행할 수 있어요." };

  const { data: svc } = await supabase
    .from("agency_services")
    .select("supply_price_krw, label")
    .eq("key", inq.service_key)
    .maybeSingle();
  if (!svc) return { error: "서비스 공급가를 찾을 수 없습니다." };

  const clientPrice = Math.round(args.clientPriceKrw);
  if (!Number.isFinite(clientPrice) || clientPrice < svc.supply_price_krw)
    return { error: `클라이언트 가격은 공급가(${svc.supply_price_krw.toLocaleString()}원) 이상이어야 해요.` };

  const code = randomUUID().replace(/-/g, "").slice(0, 10);
  const { error } = await supabase.from("agency_quotes").insert({
    inquiry_id: inq.id,
    partner_user_id: user.id,
    service_key: inq.service_key,
    supply_price_krw: svc.supply_price_krw,
    client_price_krw: clientPrice,
    margin_krw: clientPrice - svc.supply_price_krw,
    code,
    status: "sent",
  });
  if (error) return { error: "견적 발행에 실패했습니다." };

  await supabase.from("agency_inquiries").update({ status: "quoted" }).eq("id", inq.id);
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  await supabase.from("agency_messages").insert({
    inquiry_id: inq.id,
    sender_user_id: user.id,
    body: `[결제 안내] ${svc.label} ${clientPrice.toLocaleString()}원\n결제 링크: ${site}/pay/q/${code}`,
  });
  return { code };
}

/** 공개 결제용 — 코드로 견적 조회(admin, 세션 불필요). */
export async function getQuoteByCode(code: string): Promise<QuoteByCode | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agency_quotes")
    .select("id, code, service_key, client_price_krw, status")
    .eq("code", code)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    code: data.code,
    serviceLabel: await serviceLabel(data.service_key),
    clientPriceKrw: data.client_price_krw,
    status: data.status,
  };
}

/** 결제 완료 정산(멱등) — 주문 metadata.quote_id로 호출. 공급가 보유·마진 적립. */
export async function settleQuotePaid(quoteId: string, orderId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: q } = await admin
    .from("agency_quotes")
    .select("id, partner_user_id, margin_krw, status, inquiry_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (!q || q.status === "paid") return; // 멱등
  await admin
    .from("agency_quotes")
    .update({ status: "paid", order_id: orderId })
    .eq("id", q.id)
    .neq("status", "paid");
  if (q.inquiry_id)
    await admin.from("agency_inquiries").update({ status: "paid" }).eq("id", q.inquiry_id);
  await admin.from("partner_earnings").insert({
    partner_user_id: q.partner_user_id,
    quote_id: q.id,
    amount_krw: q.margin_krw,
    status: "pending",
  });
}

// ---------------- 관리자 (호출 전 requireAdmin) ----------------

export interface AdminSupplyRow {
  key: string;
  label: string;
  supplyPriceKrw: number;
  active: boolean;
}
export async function listAgencyServicesAdmin(): Promise<AdminSupplyRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agency_services")
    .select("key, label, supply_price_krw, active")
    .order("sort_order", { ascending: true });
  return (data ?? []).map((r) => ({
    key: r.key,
    label: r.label,
    supplyPriceKrw: r.supply_price_krw,
    active: r.active,
  }));
}

export async function setSupplyPrice(
  key: string,
  supplyPriceKrw: number,
  active: boolean,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("agency_services")
    .update({ supply_price_krw: supplyPriceKrw, active, updated_at: new Date().toISOString() })
    .eq("key", key);
}

export interface AdminInquiryRow {
  id: string;
  serviceLabel: string;
  status: string;
  createdAt: string;
}
/** 파트너 미배정 문의(관리자가 배정 대기). */
export async function listUnassignedInquiries(): Promise<AdminInquiryRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agency_inquiries")
    .select("id, service_key, status, created_at")
    .is("partner_user_id", null)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => ({
    id: r.id,
    serviceLabel: SERVICE_LABELS[r.service_key] ?? r.service_key,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function assignInquiryPartner(
  inquiryId: string,
  partnerUserId: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("agency_inquiries")
    .update({ partner_user_id: partnerUserId, updated_at: new Date().toISOString() })
    .eq("id", inquiryId);
}

export interface AdminEarningRow {
  id: string;
  partnerEmail: string | null;
  amountKrw: number;
  createdAt: string;
}
export async function listPendingEarnings(): Promise<AdminEarningRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_earnings")
    .select("id, partner_user_id, amount_krw, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.partner_user_id))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("user_id, email").in("user_id", ids)
    : { data: [] };
  const emailMap = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));
  return rows.map((r) => ({
    id: r.id,
    partnerEmail: emailMap.get(r.partner_user_id) ?? null,
    amountKrw: r.amount_krw,
    createdAt: r.created_at,
  }));
}

export interface ActivePartnerRow {
  profileId: string;
  userId: string;
  displayName: string;
  email: string | null;
  workStatus: string | null;
  credits: number;
  inquiries: number;
  paidWorks: number;
  pendingKrw: number;
  paidKrw: number;
}
/** 승인된(active) 파트너/서포터 현황 + 작업·정산 지표(관리자). */
export async function listActivePartners(): Promise<ActivePartnerRow[]> {
  const admin = createAdminClient();
  const { data: profs } = await admin
    .from("supporter_profiles")
    .select("id, user_id, display_name, work_status")
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  const rows = profs ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (!ids.length) return [];

  const [pr, ledger, earn, inq, quotes] = await Promise.all([
    admin.from("profiles").select("user_id, email").in("user_id", ids),
    admin.from("partner_credit_ledger").select("partner_user_id, amount").in("partner_user_id", ids),
    admin.from("partner_earnings").select("partner_user_id, amount_krw, status").in("partner_user_id", ids),
    admin.from("agency_inquiries").select("partner_user_id").in("partner_user_id", ids),
    admin.from("agency_quotes").select("partner_user_id").eq("status", "paid").in("partner_user_id", ids),
  ]);
  const emailMap = new Map((pr.data ?? []).map((p) => [p.user_id, p.email]));
  const credit = new Map<string, number>();
  for (const l of ledger.data ?? [])
    credit.set(l.partner_user_id, (credit.get(l.partner_user_id) ?? 0) + l.amount);
  const pend = new Map<string, number>();
  const paid = new Map<string, number>();
  for (const e of earn.data ?? []) {
    const m = e.status === "paid" ? paid : pend;
    m.set(e.partner_user_id, (m.get(e.partner_user_id) ?? 0) + e.amount_krw);
  }
  const inqCount = new Map<string, number>();
  for (const i of inq.data ?? [])
    if (i.partner_user_id)
      inqCount.set(i.partner_user_id, (inqCount.get(i.partner_user_id) ?? 0) + 1);
  const paidWorks = new Map<string, number>();
  for (const q of quotes.data ?? [])
    paidWorks.set(q.partner_user_id, (paidWorks.get(q.partner_user_id) ?? 0) + 1);

  return rows.map((r) => ({
    profileId: r.id,
    userId: r.user_id,
    displayName: r.display_name,
    email: emailMap.get(r.user_id) ?? null,
    workStatus: r.work_status,
    credits: credit.get(r.user_id) ?? 0,
    inquiries: inqCount.get(r.user_id) ?? 0,
    paidWorks: paidWorks.get(r.user_id) ?? 0,
    pendingKrw: pend.get(r.user_id) ?? 0,
    paidKrw: paid.get(r.user_id) ?? 0,
  }));
}

export interface EarningHistoryRow {
  id: string;
  partnerEmail: string | null;
  amountKrw: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}
/** 전체 정산 내역(대기+완료, 관리자). */
export async function listAllEarnings(limit = 200): Promise<EarningHistoryRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_earnings")
    .select("id, partner_user_id, amount_krw, status, created_at, paid_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.partner_user_id))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("user_id, email").in("user_id", ids)
    : { data: [] };
  const emailMap = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));
  return rows.map((r) => ({
    id: r.id,
    partnerEmail: emailMap.get(r.partner_user_id) ?? null,
    amountKrw: r.amount_krw,
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
  }));
}

export async function markEarningPaid(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("partner_earnings")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);
}

export interface EarningSummary {
  pendingKrw: number;
  paidKrw: number;
}
/** 파트너 수익(정산 예정/완료) 합계. */
export async function getPartnerEarnings(
  partnerUserId: string,
): Promise<EarningSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_earnings")
    .select("amount_krw, status")
    .eq("partner_user_id", partnerUserId);
  let pendingKrw = 0,
    paidKrw = 0;
  for (const r of data ?? []) {
    if (r.status === "paid") paidKrw += r.amount_krw;
    else pendingKrw += r.amount_krw;
  }
  return { pendingKrw, paidKrw };
}
