import { createAdminClient } from "@/lib/supabase/server";
import type {
  PaymentRow,
  PointPackageRow,
  ServicePriceRow,
} from "@/types/database";

/** 관리자 화면 전용 조회 — 호출 전 반드시 isCurrentUserAdmin() 확인. */

export interface AdminPayment extends PaymentRow {
  userName: string;
  userEmail: string;
}

export async function getRecentPaymentsAdmin(
  limit = 100,
): Promise<AdminPayment[]> {
  const admin = createAdminClient();
  const { data: payments } = await admin
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  const list = payments ?? [];
  if (list.length === 0) return [];

  const ids = [...new Set(list.map((p) => p.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id,name,email")
    .in("user_id", ids);
  const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return list.map((p) => ({
    ...p,
    userName: byUser.get(p.user_id)?.name ?? "이름 없음",
    userEmail: byUser.get(p.user_id)?.email ?? "",
  }));
}

export async function getAllPackagesAdmin(): Promise<PointPackageRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("point_packages")
    .select("*")
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function getServicePricesAdmin(): Promise<ServicePriceRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("service_prices")
    .select("*")
    .order("service", { ascending: true });
  return data ?? [];
}
