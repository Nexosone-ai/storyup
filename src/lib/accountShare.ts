import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * 계정 공유(파트너 위임 접근) 조회. 초대/수락은 dashboard/share/actions.ts.
 * 수락 시 partner_clients 링크가 생겨 owns_business가 파트너의 접근을 인정한다.
 */

export interface OwnerShareRow {
  /** account_shares.id, 또는 공유행 없이 partner_clients 로만 연결된 경우 `link:<partnerUserId>`. */
  id: string;
  partnerEmail: string;
  partnerName: string | null;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
  /** share = 초대/공유행, link = 파트너 등록·추천 링크로 생긴 대행 연결(partner_clients)만 있음. */
  source: "share" | "link";
  partnerUserId: string | null;
  /** 파트너 공개 소개(스토어프론트, 활성일 때만) — 표시 이름·소개·연락처·소개 페이지. */
  storefront: {
    slug: string;
    displayName: string;
    intro: string | null;
    contact: string | null;
  } | null;
}

/**
 * 나를 담당하는 파트너 — 공유행(account_shares) + 대행 연결(partner_clients) 합집합.
 * 파트너 고객 등록·추천 링크 연결 중 일부는 공유행 없이 partner_clients 만 있어
 * 공유행만 보면 '담당 파트너 없음'으로 잘못 보인다.
 */
export async function listOwnerShares(ownerId: string): Promise<OwnerShareRow[]> {
  const admin = createAdminClient();
  const [{ data }, { data: links }] = await Promise.all([
    admin
      .from("account_shares")
      .select("id, partner_email, partner_user_id, status, created_at")
      .eq("owner_user_id", ownerId)
      .neq("status", "revoked")
      .order("created_at", { ascending: false }),
    admin
      .from("partner_clients")
      .select("partner_user_id, created_at")
      .eq("client_user_id", ownerId)
      .order("created_at", { ascending: true }),
  ]);
  const rows = data ?? [];
  const shared = new Set(
    rows.map((r) => r.partner_user_id).filter((v): v is string => !!v),
  );
  const linkOnly = (links ?? []).filter((l) => !shared.has(l.partner_user_id));

  const partnerIds = [
    ...shared,
    ...linkOnly.map((l) => l.partner_user_id),
  ];
  const profiles = new Map<string, { name: string | null; email: string | null }>();
  const stores = new Map<string, OwnerShareRow["storefront"]>();
  if (partnerIds.length) {
    const [{ data: profs }, { data: fronts }] = await Promise.all([
      admin.from("profiles").select("user_id, name, email").in("user_id", partnerIds),
      admin
        .from("partner_storefronts")
        .select("partner_user_id, slug, display_name, intro, contact")
        .in("partner_user_id", partnerIds)
        .eq("status", "active"),
    ]);
    (profs ?? []).forEach((p) => profiles.set(p.user_id, { name: p.name, email: p.email }));
    (fronts ?? []).forEach((f) =>
      stores.set(f.partner_user_id, {
        slug: f.slug,
        displayName: f.display_name,
        intro: f.intro,
        contact: f.contact,
      }),
    );
  }

  return [
    ...rows.map((r) => ({
      id: r.id,
      partnerEmail: r.partner_email,
      partnerName: r.partner_user_id ? (profiles.get(r.partner_user_id)?.name ?? null) : null,
      status: r.status,
      createdAt: r.created_at,
      source: "share" as const,
      partnerUserId: r.partner_user_id,
      storefront: r.partner_user_id ? (stores.get(r.partner_user_id) ?? null) : null,
    })),
    ...linkOnly.map((l) => ({
      id: `link:${l.partner_user_id}`,
      partnerEmail: profiles.get(l.partner_user_id)?.email ?? "",
      partnerName: profiles.get(l.partner_user_id)?.name ?? null,
      status: "accepted" as const,
      createdAt: l.created_at,
      source: "link" as const,
      partnerUserId: l.partner_user_id,
      storefront: stores.get(l.partner_user_id) ?? null,
    })),
  ];
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

export interface AdminShareRow {
  id: string;
  ownerName: string | null;
  ownerEmail: string | null;
  partnerName: string | null;
  partnerEmail: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
}

/** (관리자) 전체 계정 공유 현황 — 소유자→파트너, 상태. */
export async function listAllAccountShares(): Promise<AdminShareRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("account_shares")
    .select("id, owner_user_id, partner_user_id, partner_email, status, created_at")
    .neq("status", "revoked")
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = data ?? [];
  const uids = [
    ...new Set(
      rows.flatMap((r) => [r.owner_user_id, r.partner_user_id].filter((v): v is string => !!v)),
    ),
  ];
  const info = new Map<string, { name: string | null; email: string | null }>();
  if (uids.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("user_id, name, email")
      .in("user_id", uids);
    (profs ?? []).forEach((p) => info.set(p.user_id, { name: p.name, email: p.email }));
  }
  return rows.map((r) => ({
    id: r.id,
    ownerName: info.get(r.owner_user_id)?.name ?? null,
    ownerEmail: info.get(r.owner_user_id)?.email ?? null,
    partnerName: r.partner_user_id ? (info.get(r.partner_user_id)?.name ?? null) : null,
    partnerEmail: r.partner_email,
    status: r.status,
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
