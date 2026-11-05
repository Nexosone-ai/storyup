import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { CHANNEL_SHARE_AUTO_CONFIRM_DAYS } from "./config";
import type { Database } from "@/types/database";

type Admin = ReturnType<typeof createAdminClient>;
type ShareOrderRow = Database["public"]["Tables"]["share_orders"]["Row"];

const nowIso = () => new Date().toISOString();

/**
 * 채널 보유자 증빙 제출 — status paid → shared.
 * 게시 증빙 URL을 기록하고, 광고주 미확인 시 자동확정 기한(N일)을 건다.
 * 호출 전 로그인 확인. 본인(채널 보유자) 소유 + paid 상태만 허용.
 */
export async function submitShareProof(
  ownerUserId: string,
  shareOrderId: string,
  proofUrl: string,
): Promise<{ ok?: true; error?: string }> {
  const url = proofUrl.trim();
  if (!/^https?:\/\/.+/i.test(url))
    return { error: "증빙 링크(URL)를 올바르게 입력해주세요." };

  const admin = createAdminClient();
  const { data: so } = await admin
    .from("share_orders")
    .select("id, channel_owner_user_id, status")
    .eq("id", shareOrderId)
    .maybeSingle();
  if (!so || so.channel_owner_user_id !== ownerUserId)
    return { error: "의뢰를 찾을 수 없습니다." };
  if (so.status !== "paid")
    return { error: "게시 대기 상태의 의뢰만 증빙을 제출할 수 있습니다." };

  const auto = new Date(
    Date.now() + CHANNEL_SHARE_AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await admin
    .from("share_orders")
    .update({
      status: "shared",
      proof_url: url.slice(0, 600),
      shared_at: nowIso(),
      auto_confirm_at: auto,
      updated_at: nowIso(),
    })
    .eq("id", shareOrderId)
    .eq("status", "paid");
  if (error) return { error: "증빙 제출에 실패했습니다." };
  return { ok: true };
}

/**
 * 정산 확정 — share_orders shared → settled + share_earnings held → pending(지급 대기).
 * 광고주 확인 또는 자동확정 크론이 공통으로 쓴다. 실제 송금은 하지 않는다(상태만).
 * 이미 settled면 아무 것도 하지 않는다(멱등).
 */
async function settleShareOrder(
  admin: Admin,
  so: Pick<ShareOrderRow, "id" | "status">,
): Promise<boolean> {
  if (so.status !== "shared") return false;
  // shared → settled (조건부 update로 경쟁 안전)
  const { data: updated } = await admin
    .from("share_orders")
    .update({ status: "settled", confirmed_at: nowIso(), updated_at: nowIso() })
    .eq("id", so.id)
    .eq("status", "shared")
    .select("id");
  if (!updated || updated.length === 0) return false; // 이미 다른 처리가 선점
  // 정산 원장 held → pending (지급 대기). 금융기록은 삭제하지 않고 상태만 전이.
  await admin
    .from("share_earnings")
    .update({ status: "pending" })
    .eq("share_order_id", so.id)
    .eq("status", "held");
  return true;
}

/**
 * 광고주 확인 — shared 상태의 내 의뢰를 확정(settled)한다.
 * 호출 전 로그인 확인. 본인(광고주) 소유만.
 */
export async function confirmShareOrder(
  advertiserUserId: string,
  shareOrderId: string,
): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { data: so } = await admin
    .from("share_orders")
    .select("id, advertiser_user_id, status")
    .eq("id", shareOrderId)
    .maybeSingle();
  if (!so || so.advertiser_user_id !== advertiserUserId)
    return { error: "의뢰를 찾을 수 없습니다." };
  if (so.status === "settled") return { ok: true };
  if (so.status !== "shared")
    return { error: "증빙이 제출된 의뢰만 확인할 수 있습니다." };
  const done = await settleShareOrder(admin, so);
  return done ? { ok: true } : { error: "확인 처리에 실패했습니다." };
}

/**
 * 자동확정 — 증빙 제출 후(shared) 기한(auto_confirm_at)이 지난 의뢰를 일괄 확정한다.
 * 크론에서 호출(CRON_SECRET 가드). 반환: 처리 건수.
 */
export async function autoConfirmDueShares(): Promise<{ confirmed: number }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("share_orders")
    .select("id, status, auto_confirm_at")
    .eq("status", "shared")
    .lte("auto_confirm_at", nowIso())
    .limit(500);
  let confirmed = 0;
  for (const so of data ?? []) {
    if (await settleShareOrder(admin, so)) confirmed++;
  }
  return { confirmed };
}

// ---------------- 채널 보유자 수익 ----------------
export interface ShareEarningView {
  id: string;
  shareOrderId: string;
  grossKrw: number;
  feeKrw: number;
  netKrw: number;
  status: string; // held | pending | paid
  platform: string;
  contentTitle: string | null;
  orderStatus: string;
  createdAt: string;
}

export interface OwnerEarnings {
  rows: ShareEarningView[];
  /** 지급 완료 누계(net). */
  paidKrw: number;
  /** 지급 대기(pending) 누계(net). */
  pendingKrw: number;
  /** 에스크로(held, 확정 전) 누계(net). */
  heldKrw: number;
}

/** 채널 보유자 정산 내역 + 상태별 합계. */
export async function listOwnerEarnings(
  ownerUserId: string,
): Promise<OwnerEarnings> {
  const admin = createAdminClient();
  const { data: earns } = await admin
    .from("share_earnings")
    .select("*")
    .eq("channel_owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });
  const list = earns ?? [];
  const orderIds = [...new Set(list.map((e) => e.share_order_id))];
  const { data: orders } = orderIds.length
    ? await admin
        .from("share_orders")
        .select("id, platform, content_title, status")
        .in("id", orderIds)
    : { data: [] };
  const oMap = new Map((orders ?? []).map((o) => [o.id, o]));

  let paidKrw = 0;
  let pendingKrw = 0;
  let heldKrw = 0;
  const rows: ShareEarningView[] = list.map((e) => {
    if (e.status === "paid") paidKrw += e.net_krw;
    else if (e.status === "pending") pendingKrw += e.net_krw;
    else heldKrw += e.net_krw;
    const o = oMap.get(e.share_order_id);
    return {
      id: e.id,
      shareOrderId: e.share_order_id,
      grossKrw: e.gross_krw,
      feeKrw: e.fee_krw,
      netKrw: e.net_krw,
      status: e.status,
      platform: o?.platform ?? "",
      contentTitle: o?.content_title ?? null,
      orderStatus: o?.status ?? "",
      createdAt: e.created_at,
    };
  });
  return { rows, paidKrw, pendingKrw, heldKrw };
}

// ---------------- 관리자 운영 ----------------
export interface AdminShareOrderRow {
  id: string;
  advertiserLabel: string;
  ownerLabel: string;
  platform: string;
  priceKrw: number;
  contentType: string;
  contentUrl: string;
  contentTitle: string | null;
  status: string;
  proofUrl: string | null;
  createdAt: string;
  earningStatus: string | null;
  netKrw: number | null;
}

/** 관리자 — 공유 의뢰 전체(결제된 것 위주) + 정산 상태. 호출 전 관리자 확인. */
export async function listShareOrdersAdmin(): Promise<AdminShareOrderRow[]> {
  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("share_orders")
    .select("*")
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = orders ?? [];
  const ids = [
    ...new Set(
      rows.flatMap((r) => [r.advertiser_user_id, r.channel_owner_user_id]),
    ),
  ];
  const { data: profiles } = ids.length
    ? await admin
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", ids)
    : { data: [] };
  const pMap = new Map(
    (profiles ?? []).map((p) => [
      p.user_id,
      p.name || p.email || p.user_id.slice(0, 8),
    ]),
  );
  const orderIds = rows.map((r) => r.id);
  const { data: earns } = orderIds.length
    ? await admin
        .from("share_earnings")
        .select("share_order_id, status, net_krw")
        .in("share_order_id", orderIds)
    : { data: [] };
  const eMap = new Map((earns ?? []).map((e) => [e.share_order_id, e]));
  return rows.map((r) => {
    const e = eMap.get(r.id);
    return {
      id: r.id,
      advertiserLabel: pMap.get(r.advertiser_user_id) ?? r.advertiser_user_id.slice(0, 8),
      ownerLabel: pMap.get(r.channel_owner_user_id) ?? r.channel_owner_user_id.slice(0, 8),
      platform: r.platform,
      priceKrw: r.price_krw,
      contentType: r.content_type,
      contentUrl: r.content_url,
      contentTitle: r.content_title,
      status: r.status,
      proofUrl: r.proof_url,
      createdAt: r.created_at,
      earningStatus: e?.status ?? null,
      netKrw: e?.net_krw ?? null,
    };
  });
}

/**
 * 관리자 — 정산 지급 완료 표시. share_earnings pending → paid (상태·paid_at만).
 * 실제 송금은 수동. 금융기록 삭제 없음. settled 주문의 pending 정산만 허용.
 */
export async function setShareEarningPaid(
  shareOrderId: string,
): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("share_earnings")
    .update({ status: "paid", paid_at: nowIso() })
    .eq("share_order_id", shareOrderId)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: "정산 처리에 실패했습니다." };
  if (!updated || updated.length === 0)
    return { error: "지급 대기(pending) 상태의 정산만 완료 처리할 수 있습니다." };
  return { ok: true };
}

/**
 * 관리자 — 환불/분쟁 상태 전환. 주문 상태만 바꾸고 금융기록은 보존한다.
 * 환불 시 정산 원장은 held로 되돌려(지급 대기열에서 제외). 실제 PG 환불·송금은 수동.
 */
export async function setShareOrderAdminStatus(
  shareOrderId: string,
  status: "refunded" | "disputed",
): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("share_orders")
    .update({ status, updated_at: nowIso() })
    .eq("id", shareOrderId);
  if (error) return { error: "상태 변경에 실패했습니다." };
  if (status === "refunded") {
    // 아직 지급되지 않은 정산만 보류(held)로 — 이미 paid면 건드리지 않음(기록 보존).
    await admin
      .from("share_earnings")
      .update({ status: "held" })
      .eq("share_order_id", shareOrderId)
      .eq("status", "pending");
  }
  return { ok: true };
}
