import { createAdminClient } from "@/lib/supabase/server";
import type { AdCampaignRow, Json } from "@/types/database";

export interface CampaignCreative {
  image?: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  aspect?: "4:1" | "3:1" | "16:9" | "1:1";
}

export interface CampaignInput {
  name: string;
  creative: CampaignCreative;
  targetUrl: string;
  bidAmount: number;
  totalBudget: number;
  industry?: string | null;
}

function validate(input: CampaignInput): string | null {
  if (!input.name.trim()) return "캠페인 이름을 입력하세요.";
  if (!/^https?:\/\//i.test(input.targetUrl.trim()))
    return "이동할 링크(target URL)를 http(s):// 형식으로 입력하세요.";
  if (!Number.isInteger(input.bidAmount) || input.bidAmount <= 0)
    return "클릭당 단가를 올바르게 입력하세요.";
  if (!Number.isInteger(input.totalBudget) || input.totalBudget < input.bidAmount)
    return "총 예산은 클릭당 단가 이상이어야 합니다.";
  return null;
}

export async function listCampaigns(businessId: string): Promise<AdCampaignRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ad_campaigns")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCampaign(id: string): Promise<AdCampaignRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ad_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

/** 캠페인 생성 → 검수 대기(pending_review). */
export async function createCampaign(
  businessId: string,
  input: CampaignInput,
): Promise<{ id?: string; error?: string }> {
  const err = validate(input);
  if (err) return { error: err };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ad_campaigns")
    .insert({
      business_id: businessId,
      type: "cpc",
      name: input.name.trim().slice(0, 80),
      creative: (input.creative ?? {}) as unknown as Json,
      target_url: input.targetUrl.trim(),
      bid_amount: input.bidAmount,
      total_budget: input.totalBudget,
      status: "pending_review",
      industry: input.industry ?? null,
    })
    .select("id")
    .single();
  if (error || !data)
    return { error: "캠페인 생성에 실패했습니다. (0055 마이그레이션 확인)" };
  return { id: data.id };
}

/** 광고주 상태 변경 — 승인된 캠페인의 재개/일시중지/종료만 허용. */
export async function setCampaignStatusByOwner(
  id: string,
  status: "active" | "paused" | "ended",
): Promise<{ ok?: boolean; error?: string }> {
  const admin = createAdminClient();
  const c = await getCampaign(id);
  if (!c) return { error: "캠페인을 찾을 수 없습니다." };
  // 활성/일시중지 간 전환과 종료만. active로의 전환은 검수 통과(=승인되어 active였던) 캠페인만.
  if (status === "active" && !["paused"].includes(c.status))
    return { error: "검수 승인 후에만 재개할 수 있습니다." };
  if (status !== "ended" && c.status === "pending_review")
    return { error: "검수 중인 캠페인입니다." };
  const { error } = await admin
    .from("ad_campaigns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { error: "상태 변경 실패" } : { ok: true };
}

export interface AdminCampaignItem extends AdCampaignRow {
  businessName: string;
  balance: number;
}

export async function listCampaignsAdmin(): Promise<AdminCampaignItem[]> {
  const admin = createAdminClient();
  const { data: campaigns } = await admin
    .from("ad_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  const list = campaigns ?? [];
  if (list.length === 0) return [];
  const bizIds = [...new Set(list.map((c) => c.business_id))];
  const [{ data: bizs }, { data: wallet }] = await Promise.all([
    admin.from("businesses").select("id,name").in("id", bizIds),
    admin.from("ad_wallet_tx").select("business_id,amount").in("business_id", bizIds),
  ]);
  const nameById = new Map((bizs ?? []).map((b) => [b.id, b.name]));
  const balById = new Map<string, number>();
  for (const w of wallet ?? [])
    balById.set(w.business_id, (balById.get(w.business_id) ?? 0) + w.amount);
  return list.map((c) => ({
    ...c,
    businessName: nameById.get(c.business_id) ?? "",
    balance: balById.get(c.business_id) ?? 0,
  }));
}

/** 관리자 검수 — 승인(active) 또는 반려(rejected). */
export async function reviewCampaign(
  id: string,
  approve: boolean,
  note?: string,
): Promise<{ ok?: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ad_campaigns")
    .update({
      status: approve ? "active" : "rejected",
      review_note: note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return error ? { error: "검수 처리 실패" } : { ok: true };
}
