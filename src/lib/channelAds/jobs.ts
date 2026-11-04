import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ShareOrderRow =
  Database["public"]["Tables"]["share_orders"]["Row"];

export interface ShareJob {
  id: string;
  platform: string;
  priceKrw: number;
  contentType: string;
  contentUrl: string;
  contentTitle: string | null;
  message: string | null;
  status: string;
  proofUrl: string | null;
  createdAt: string;
}

function toJob(r: ShareOrderRow): ShareJob {
  return {
    id: r.id,
    platform: r.platform,
    priceKrw: r.price_krw,
    contentType: r.content_type,
    contentUrl: r.content_url,
    contentTitle: r.content_title,
    message: r.message,
    status: r.status,
    proofUrl: r.proof_url,
    createdAt: r.created_at,
  };
}

/** 채널 보유자에게 들어온 의뢰(결제 완료 이후 단계만). */
export async function listOwnerJobs(ownerUserId: string): Promise<ShareJob[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("share_orders")
    .select("*")
    .eq("channel_owner_user_id", ownerUserId)
    .in("status", ["paid", "shared", "confirmed", "settled", "disputed"])
    .order("created_at", { ascending: false });
  return (data ?? []).map(toJob);
}

/** 광고주 본인이 보낸 의뢰 내역. */
export async function listMyShareRequests(
  advertiserUserId: string,
): Promise<ShareJob[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("share_orders")
    .select("*")
    .eq("advertiser_user_id", advertiserUserId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(toJob);
}
