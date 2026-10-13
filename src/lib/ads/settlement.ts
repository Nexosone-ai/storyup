import { createAdminClient } from "@/lib/supabase/server";
import type { AdSettlementRow } from "@/types/database";

const FREELANCER_TAX_RATE = 0.033;

function monthRange(period: string) {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  return { start: start.toISOString(), end: end.toISOString(), label };
}

/** 월별 광고 수익 정산 생성 — pending ad_earnings를 블로거별로 마감(3.3% 원천징수). */
export async function generateAdSettlements(
  period: string,
): Promise<{ ok?: boolean; error?: string; created?: number }> {
  if (!/^\d{4}-\d{2}$/.test(period))
    return { error: "정산 월 형식이 올바르지 않습니다. (예: 2026-10)" };
  const admin = createAdminClient();
  const { start, end, label } = monthRange(period);

  const { data: pending } = await admin
    .from("ad_earnings")
    .select("id,blogger_user_id,amount")
    .eq("status", "pending")
    .gte("occurred_at", start)
    .lt("occurred_at", end);
  const rows = pending ?? [];
  if (rows.length === 0) return { ok: true, created: 0 };

  const byBlogger = new Map<string, { ids: string[]; gross: number }>();
  for (const r of rows) {
    const g = byBlogger.get(r.blogger_user_id) ?? { ids: [], gross: 0 };
    g.ids.push(r.id);
    g.gross += r.amount;
    byBlogger.set(r.blogger_user_id, g);
  }

  let created = 0;
  for (const [bloggerId, g] of byBlogger) {
    const { data: existing } = await admin
      .from("ad_settlements")
      .select("*")
      .eq("blogger_user_id", bloggerId)
      .eq("period", label)
      .maybeSingle();
    if (existing?.status === "paid") continue;
    const gross = (existing?.gross ?? 0) + g.gross;
    const count = (existing?.earning_count ?? 0) + g.ids.length;
    const tax = Math.round(gross * FREELANCER_TAX_RATE);
    const net = gross - tax;
    const { data: settlement, error } = await admin
      .from("ad_settlements")
      .upsert(
        {
          ...(existing ? { id: existing.id } : {}),
          blogger_user_id: bloggerId,
          period: label,
          gross,
          tax,
          net,
          earning_count: count,
          status: "open",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "blogger_user_id,period" },
      )
      .select("id")
      .single();
    if (error || !settlement) continue;
    await admin
      .from("ad_earnings")
      .update({ status: "settled", settlement_id: settlement.id })
      .in("id", g.ids);
    created++;
  }
  return { ok: true, created };
}

export async function markAdSettlementPaid(
  settlementId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("ad_settlements")
    .update({ status: "paid", paid_at: now, updated_at: now })
    .eq("id", settlementId);
  if (error) return { error: "지급 처리에 실패했습니다." };
  await admin
    .from("ad_earnings")
    .update({ status: "paid" })
    .eq("settlement_id", settlementId);
  return { ok: true };
}

export async function listAdSettlementsAdmin(): Promise<
  (AdSettlementRow & { name: string; email: string })[]
> {
  const admin = createAdminClient();
  const { data: settlements } = await admin
    .from("ad_settlements")
    .select("*")
    .order("period", { ascending: false })
    .limit(200);
  const list = settlements ?? [];
  if (list.length === 0) return [];
  const ids = [...new Set(list.map((s) => s.blogger_user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id,name,email")
    .in("user_id", ids);
  const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return list.map((s) => ({
    ...s,
    name: byUser.get(s.blogger_user_id)?.name ?? "이름 없음",
    email: byUser.get(s.blogger_user_id)?.email ?? "",
  }));
}
