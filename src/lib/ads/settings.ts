import { createAdminClient } from "@/lib/supabase/server";

/** 플랫폼 수수료 %(광고주 지출 대비). 기본 20. */
export async function getPlatformFeePct(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ad_settings")
    .select("platform_fee_pct")
    .eq("id", 1)
    .maybeSingle();
  return data?.platform_fee_pct ?? 20;
}

export async function setPlatformFeePct(pct: number): Promise<void> {
  const v = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const admin = createAdminClient();
  await admin
    .from("ad_settings")
    .upsert(
      { id: 1, platform_fee_pct: v, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
}
