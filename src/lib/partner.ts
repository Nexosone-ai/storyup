import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * 대행 파트너 — partner 플랜 계정이 관리자에게 배정받은 고객 사업장을 운영한다.
 * 파트너 여부는 '본인' 구독으로 판정한다(account_owner 해석 안 함 — 파트너가 고객
 * 사업장을 운영할 때 고객 플랜으로 오판되면 안 되므로). 서버 전용.
 */

/** 사용자 본인의 플랜이 partner(활성·미만료)인지. */
export async function isPartner(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status !== "active" || data.plan !== "partner") return false;
  if (
    data.current_period_end &&
    new Date(data.current_period_end).getTime() < Date.now()
  )
    return false;
  return true;
}

/** 현재 세션 사용자가 파트너인지. */
export async function isCurrentUserPartner(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return isPartner(user.id);
}

/** 이 고객(오너 user_id)에게 배정된 대행 파트너가 있는지 — 오토파일럿 게이트용. */
export async function businessManagedByPartner(
  clientUserId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("partner_clients")
    .select("id", { count: "exact", head: true })
    .eq("client_user_id", clientUserId);
  return (count ?? 0) > 0;
}

export interface PartnerClientBiz {
  clientUserId: string;
  clientName: string | null;
  clientEmail: string | null;
  businesses: { id: string; name: string }[];
}

/** 파트너에게 배정된 고객 + 각 고객의 사업장 목록(관리자 클라이언트로 조회). */
export async function listPartnerClients(
  partnerUserId: string,
): Promise<PartnerClientBiz[]> {
  const admin = createAdminClient();
  const { data: links } = await admin
    .from("partner_clients")
    .select("client_user_id")
    .eq("partner_user_id", partnerUserId);
  const clientIds = [...new Set((links ?? []).map((l) => l.client_user_id))];
  if (!clientIds.length) return [];

  const [{ data: profiles }, { data: bizs }] = await Promise.all([
    admin.from("profiles").select("user_id, name, email").in("user_id", clientIds),
    admin.from("businesses").select("id, name, user_id").in("user_id", clientIds),
  ]);
  const pMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const bMap = new Map<string, { id: string; name: string }[]>();
  for (const b of bizs ?? []) {
    const arr = bMap.get(b.user_id) ?? [];
    arr.push({ id: b.id, name: b.name });
    bMap.set(b.user_id, arr);
  }
  return clientIds.map((cid) => ({
    clientUserId: cid,
    clientName: pMap.get(cid)?.name ?? null,
    clientEmail: pMap.get(cid)?.email ?? null,
    businesses: bMap.get(cid) ?? [],
  }));
}

export interface PartnerAssignmentRow {
  id: string;
  partnerEmail: string | null;
  clientEmail: string | null;
  createdAt: string;
}

/** 관리자용 — 전체 파트너↔고객 배정 목록. */
export async function listPartnerAssignments(): Promise<PartnerAssignmentRow[]> {
  const admin = createAdminClient();
  const { data: links } = await admin
    .from("partner_clients")
    .select("id, partner_user_id, client_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = links ?? [];
  const ids = [
    ...new Set(rows.flatMap((r) => [r.partner_user_id, r.client_user_id])),
  ];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("user_id, email").in("user_id", ids)
    : { data: [] };
  const emailMap = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));
  return rows.map((r) => ({
    id: r.id,
    partnerEmail: emailMap.get(r.partner_user_id) ?? null,
    clientEmail: emailMap.get(r.client_user_id) ?? null,
    createdAt: r.created_at,
  }));
}
