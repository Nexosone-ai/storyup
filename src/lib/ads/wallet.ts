import { createAdminClient } from "@/lib/supabase/server";

/** 광고 지갑 잔액 (business별, 원장 합계). */
export async function getAdBalance(businessId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ad_wallet_tx")
    .select("amount")
    .eq("business_id", businessId);
  return (data ?? []).reduce((s, r) => s + r.amount, 0);
}

/** 원자적 차감(이중지출 방지). 잔액 부족이면 insufficient. 중복 ref면 조용히 실패. */
export async function spendFromWallet(args: {
  businessId: string;
  amount: number;
  reason: string;
  refType: string;
  refId: string;
}): Promise<{ ok: boolean; insufficient?: boolean }> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("ad_wallet_spend", {
    p_business: args.businessId,
    p_amount: args.amount,
    p_reason: args.reason,
    p_ref_type: args.refType,
    p_ref_id: args.refId,
  });
  if (!error) return { ok: true };
  if ((error.message || "").includes("INSUFFICIENT_FUNDS"))
    return { ok: false, insufficient: true };
  if (error.code === "23505") return { ok: false }; // 이미 기록된 ref
  console.error("[ads] wallet spend failed", args.refId, error);
  return { ok: false };
}

/** 충전 크레딧(멱등: ref_type='deposit', ref_id=order.id). */
export async function creditDeposit(args: {
  businessId: string;
  amount: number;
  orderRowId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("ad_wallet_tx").insert({
    business_id: args.businessId,
    amount: args.amount,
    reason: "광고비 충전",
    ref_type: "deposit",
    ref_id: args.orderRowId,
  });
  if (error && error.code !== "23505")
    console.error("[ads] credit deposit failed", args.orderRowId, error);
}
