import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * 계정 공유(파트너 위임 접근) 조회. 초대/수락은 dashboard/share/actions.ts.
 * 수락 시 partner_clients 링크가 생겨 owns_business가 파트너의 접근을 인정한다.
 */

export interface OwnerShareRow {
  id: string;
  partnerEmail: string;
  partnerName: string | null;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
}

/** 소유자가 공유한 파트너 목록(내가 만든 초대). */
export async function listOwnerShares(ownerId: string): Promise<OwnerShareRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("account_shares")
    .select("id, partner_email, partner_user_id, status, created_at")
    .eq("owner_user_id", ownerId)
    .neq("status", "revoked")
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const partnerIds = rows.map((r) => r.partner_user_id).filter((v): v is string => !!v);
  const names = new Map<string, string | null>();
  if (partnerIds.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("user_id, name")
      .in("user_id", partnerIds);
    (profs ?? []).forEach((p) => names.set(p.user_id, p.name));
  }
  return rows.map((r) => ({
    id: r.id,
    partnerEmail: r.partner_email,
    partnerName: r.partner_user_id ? (names.get(r.partner_user_id) ?? null) : null,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export interface IncomingShareRow {
  id: string;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: string;
}

/** 파트너에게 들어온 '대기중' 초대(이메일 매칭). */
export async function listIncomingShares(email: string): Promise<IncomingShareRow[]> {
  const e = email.trim().toLowerCase();
  if (!e) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("account_shares")
    .select("id, owner_user_id, created_at")
    .eq("partner_email", e)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const ownerIds = rows.map((r) => r.owner_user_id);
  const owners = new Map<string, { name: string | null; email: string | null }>();
  if (ownerIds.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("user_id, name, email")
      .in("user_id", ownerIds);
    (profs ?? []).forEach((p) => owners.set(p.user_id, { name: p.name, email: p.email }));
  }
  return rows.map((r) => ({
    id: r.id,
    ownerName: owners.get(r.owner_user_id)?.name ?? null,
    ownerEmail: owners.get(r.owner_user_id)?.email ?? null,
    createdAt: r.created_at,
  }));
}

export interface SharedAccount {
  ownerUserId: string;
  ownerName: string | null;
  businesses: { id: string; name: string | null }[];
}

/** 파트너가 '접근 중'인 공유 계정 + 그 계정의 사업장(열어서 작업). */
export async function listSharedAccounts(partnerId: string): Promise<SharedAccount[]> {
  const supabase = await createClient();
  // 수락한 공유(RLS: partner_user_id=본인).
  const { data: shares } = await supabase
    .from("account_shares")
    .select("owner_user_id")
    .eq("partner_user_id", partnerId)
    .eq("status", "accepted");
  const ownerIds = [...new Set((shares ?? []).map((s) => s.owner_user_id))];
  if (ownerIds.length === 0) return [];

  const admin = createAdminClient();
  const [{ data: profs }, { data: biz }] = await Promise.all([
    admin.from("profiles").select("user_id, name").in("user_id", ownerIds),
    admin.from("businesses").select("id, name, user_id").in("user_id", ownerIds),
  ]);
  const nameOf = new Map((profs ?? []).map((p) => [p.user_id, p.name]));
  return ownerIds.map((oid) => ({
    ownerUserId: oid,
    ownerName: nameOf.get(oid) ?? null,
    businesses: (biz ?? [])
      .filter((b) => b.user_id === oid)
      .map((b) => ({ id: b.id, name: b.name })),
  }));
}
