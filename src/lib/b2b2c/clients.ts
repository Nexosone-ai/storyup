import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * 기본(본사) 파트너 계정 — 기존 B2C 고객을 담아두는 'passthrough' 파트너.
 * 이 파트너의 고객은 기존 B2C 경험(요금제 화면·구독관리)을 그대로 유지한다.
 * 외부(실제) 파트너의 고객에게만 기본요금을 숨기고 파트너 중개 화면을 적용한다.
 */
export const HOUSE_PARTNER_EMAIL = "nexosoneai@gmail.com";

let housePartnerIdCache: string | null | undefined;

/** 본사 파트너 user_id(이메일로 해석, 캐시). 없으면 null. */
export async function getHousePartnerId(): Promise<string | null> {
  if (housePartnerIdCache !== undefined) return housePartnerIdCache;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", HOUSE_PARTNER_EMAIL)
    .maybeSingle();
  housePartnerIdCache = data?.user_id ?? null;
  return housePartnerIdCache;
}

/**
 * 외부(비본사) 파트너에게 배정된 고객인가? — 기본요금을 숨길 대상 판별.
 * 본사 파트너에게만 배정된 고객(=기존 B2C 백필)은 false(정상 B2C 유지).
 */
export async function isExternalPartnerClient(
  userId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_clients")
    .select("partner_user_id")
    .eq("client_user_id", userId);
  if (!data || data.length === 0) return false;
  const houseId = await getHousePartnerId();
  // 본사 파트너 외의 파트너에 배정돼 있으면 외부 파트너 고객.
  return data.some((r) => r.partner_user_id !== houseId);
}
