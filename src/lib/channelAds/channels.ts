import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SharePlatform } from "./config";

export type ShareChannelRow =
  Database["public"]["Tables"]["share_channels"]["Row"];

export interface ChannelInput {
  id?: string;
  platform: SharePlatform;
  handle?: string | null;
  url?: string | null;
  followerCount?: number;
  priceKrw: number;
  description?: string | null;
}

/** 내 채널 목록(상태 불문). 세션 RLS로 본인 것만. */
export async function listMyChannels(
  userId: string,
): Promise<ShareChannelRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("share_channels")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * 채널 등록/수정 — 호출 전 로그인 확인. 세션 RLS 클라이언트(본인만).
 * 신규/수정 모두 status='pending'으로 두어 관리자 승인을 거치게 한다.
 */
export async function upsertChannel(
  userId: string,
  input: ChannelInput,
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const row = {
    user_id: userId,
    platform: input.platform,
    handle: input.handle?.trim() || null,
    url: input.url?.trim() || null,
    follower_count: Math.max(0, Math.floor(input.followerCount ?? 0)),
    price_krw: Math.max(0, Math.floor(input.priceKrw)),
    description: input.description?.trim() || null,
    status: "pending",
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("share_channels")
      .update(row)
      .eq("id", input.id)
      .eq("user_id", userId);
    if (error) {
      console.error("[channel-ads] channel update failed", error);
      return { error: "채널 저장에 실패했습니다." };
    }
    return { id: input.id };
  }

  const { data, error } = await supabase
    .from("share_channels")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) {
    console.error("[channel-ads] channel insert failed", error);
    return { error: "채널 등록에 실패했습니다." };
  }
  return { id: data.id };
}

/** 채널 숨김/표시 토글(보유자) — active↔hidden. 승인 전(pending/rejected)은 불가. */
export async function setChannelHidden(
  userId: string,
  id: string,
  hidden: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: ch } = await supabase
    .from("share_channels")
    .select("status")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!ch) return { error: "채널을 찾을 수 없습니다." };
  if (ch.status !== "active" && ch.status !== "hidden")
    return { error: "승인된 채널만 표시 설정을 바꿀 수 있습니다." };
  const { error } = await supabase
    .from("share_channels")
    .update({ status: hidden ? "hidden" : "active", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: "변경에 실패했습니다." };
  return {};
}

export interface DirectoryChannel {
  id: string;
  ownerUserId: string;
  platform: string;
  handle: string | null;
  url: string | null;
  followerCount: number;
  priceKrw: number;
  description: string | null;
}

/** 공개 채널 디렉토리 — active만, 가격 오름차순. 광고주가 고른다. */
export async function getChannelDirectory(): Promise<DirectoryChannel[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("share_channels")
    .select("*")
    .eq("status", "active")
    .order("price_krw", { ascending: true })
    .order("follower_count", { ascending: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    ownerUserId: c.user_id,
    platform: c.platform,
    handle: c.handle,
    url: c.url,
    followerCount: c.follower_count,
    priceKrw: c.price_krw,
    description: c.description,
  }));
}

export async function getChannelById(
  id: string,
): Promise<ShareChannelRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("share_channels")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

// ---------------- 관리자 ----------------
export interface AdminChannelRow {
  id: string;
  ownerLabel: string;
  platform: string;
  handle: string | null;
  url: string | null;
  followerCount: number;
  priceKrw: number;
  description: string | null;
  status: string;
  createdAt: string;
}

/** 관리자 — 채널 목록(승인 대기 우선). 호출 전 isCurrentUserAdmin 확인. */
export async function listChannelsAdmin(
  statusFilter?: string,
): Promise<AdminChannelRow[]> {
  const admin = createAdminClient();
  let q = admin
    .from("share_channels")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (statusFilter) q = q.eq("status", statusFilter);
  const { data } = await q;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("user_id, name, email").in("user_id", ids)
    : { data: [] };
  const pMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.name || p.email || p.user_id.slice(0, 8)]),
  );
  return rows.map((r) => ({
    id: r.id,
    ownerLabel: pMap.get(r.user_id) ?? r.user_id.slice(0, 8),
    platform: r.platform,
    handle: r.handle,
    url: r.url,
    followerCount: r.follower_count,
    priceKrw: r.price_krw,
    description: r.description,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/** 관리자 — 채널 승인/반려/숨김. 호출 전 isCurrentUserAdmin 확인. */
export async function setChannelStatus(
  id: string,
  status: "active" | "rejected" | "hidden" | "pending",
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("share_channels")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "상태 변경에 실패했습니다." };
  return {};
}
