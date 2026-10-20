import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * 템플릿 판매/정산(E1) — 발행→판매→소유권→디자이너 정산.
 * 결제 자체는 기존 PortOne 상품 경로(fulfillProductOrder)가 처리하고, 여기선
 * '템플릿 판매 상품'일 때의 이행(소유권 기록 + 디자이너 정산 적립)만 담당한다.
 * 모든 쓰기는 서비스롤(admin client). 멱등(order_id/purchase_id unique).
 */

/** 템플릿 판매 상품 결제 이행 — fulfillProductOrder에서 호출(멱등). 처리했으면 true. */
export async function fulfillTemplateOrder(
  orderId: string,
  versionId: string,
): Promise<boolean> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("product_orders")
    .select("id, status, amount, buyer_email")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!order || order.status !== "PAID") return false;

  // 발행된 리스팅(판매중)에서 디자이너·수수료·가격 확인.
  const { data: listing } = await admin
    .from("template_listings")
    .select("id, designer_user_id, commission_pct, template_id")
    .eq("version_id", versionId)
    .maybeSingle();
  if (!listing) return false;

  const email = (order.buyer_email ?? "").trim().toLowerCase();
  let buyerUserId: string | null = null;
  if (email) {
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();
    buyerUserId = profile?.user_id ?? null;
  }

  // 소유권 기록(멱등: order_id unique). 이미 있으면 그 행을 재사용.
  const { data: inserted } = await admin
    .from("template_sales")
    .insert({
      buyer_user_id: buyerUserId,
      buyer_email: email || null,
      listing_id: listing.id,
      template_version_id: versionId,
      order_id: orderId,
      amount_krw: order.amount,
    })
    .select("id")
    .maybeSingle();

  let purchaseId = inserted?.id ?? null;
  if (!purchaseId) {
    const { data: existing } = await admin
      .from("template_sales")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    purchaseId = existing?.id ?? null;
  }
  if (!purchaseId) return false;

  // 디자이너 정산 적립(멱등: purchase_id unique). net = gross × (100−수수료)/100.
  const gross = order.amount;
  const commission = listing.commission_pct ?? 30;
  const net = Math.round((gross * (100 - commission)) / 100);
  await admin
    .from("designer_earnings")
    .insert({
      designer_user_id: listing.designer_user_id,
      purchase_id: purchaseId,
      listing_id: listing.id,
      gross_krw: gross,
      commission_pct: commission,
      net_krw: net,
      status: "pending",
    })
    .select("id")
    .maybeSingle(); // 중복(23505)은 무시 — 이미 적립됨.

  return true;
}

// ---------------- 관리자/디자이너 조회 (호출 전 권한 확인) ----------------

export interface PendingEarningRow {
  id: string;
  designerEmail: string | null;
  listingTitle: string;
  grossKrw: number;
  commissionPct: number;
  netKrw: number;
  createdAt: string;
}

/** 관리자 — 미지급 디자이너 정산 목록(디자이너 이메일·리스팅명 포함). */
export async function listPendingDesignerEarnings(): Promise<PendingEarningRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("designer_earnings")
    .select("id, designer_user_id, listing_id, gross_krw, commission_pct, net_krw, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const designerIds = [...new Set(rows.map((r) => r.designer_user_id))];
  const listingIds = [...new Set(rows.map((r) => r.listing_id).filter(Boolean) as string[])];
  const [{ data: profiles }, { data: listings }] = await Promise.all([
    admin.from("profiles").select("user_id, email").in("user_id", designerIds),
    listingIds.length
      ? admin.from("template_listings").select("id, title").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const emailById = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));
  const titleById = new Map((listings ?? []).map((l) => [l.id, l.title]));

  return rows.map((r) => ({
    id: r.id,
    designerEmail: emailById.get(r.designer_user_id) ?? null,
    listingTitle: (r.listing_id && titleById.get(r.listing_id)) || "(삭제된 리스팅)",
    grossKrw: r.gross_krw,
    commissionPct: r.commission_pct,
    netKrw: r.net_krw,
    createdAt: r.created_at,
  }));
}

/** 관리자 — 정산 지급 처리(멱등). */
export async function markDesignerEarningPaid(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("designer_earnings")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
}
