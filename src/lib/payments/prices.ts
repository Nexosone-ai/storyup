import { createAdminClient } from "@/lib/supabase/server";

/**
 * AI 서비스 과금 단가(포인트) — 관리자 화면(service_prices)이 단일 소스.
 * 요금제 제공량 초과분(overage)과 제공량 비대상 서비스 과금이 모두 이 값을 쓴다.
 * active=false · 미설정 · 0 이하 · 테이블 없음(마이그레이션 전) → 0(무료)로 취급.
 */

/** 서비스 1건당 유효 과금 포인트. 무료/미설정이면 0. */
export async function getServicePrice(service: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("service_prices")
    .select("price, active")
    .eq("service", service)
    .maybeSingle();
  if (!data || !data.active || data.price <= 0) return 0;
  return data.price;
}

/** 여러 서비스의 유효 과금 포인트를 한 번에 조회. 각 값은 무료면 0. */
export async function getServicePrices(
  services: string[],
): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  for (const s of services) map[s] = 0;
  if (services.length === 0) return map;

  const admin = createAdminClient();
  const { data } = await admin
    .from("service_prices")
    .select("service, price, active")
    .in("service", services);
  for (const row of data ?? []) {
    map[row.service] = row.active && row.price > 0 ? row.price : 0;
  }
  return map;
}
