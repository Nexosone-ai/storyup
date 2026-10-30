import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPlanById, type PlanId } from "@/lib/plans";
import { PLAN_PRICE_VERSION, type VatMode, type BillingType } from "./config";
import type { Database } from "@/types/database";

export type ProductRow =
  Database["public"]["Tables"]["partner_products"]["Row"];

/** 기준 요금제의 현재 기본요금(원). 요금제 미연동(null)·없는 플랜이면 0. */
export function basePriceForPlan(basePlan: string | null): number {
  if (basePlan !== "basic" && basePlan !== "pro") return 0;
  return getPlanById(basePlan as PlanId).priceKrw ?? 0;
}

/**
 * 판매가와 기본요금의 관계. delta = 판매가 − 기본요금(예상 차액, 순이익 아님).
 * belowBase = 판매가가 기본요금보다 낮음(경고용, 차단하지 않음).
 */
export function priceDelta(
  sellPriceKrw: number,
  basePriceKrw: number,
): { deltaKrw: number; belowBase: boolean } {
  const deltaKrw = sellPriceKrw - basePriceKrw;
  return { deltaKrw, belowBase: deltaKrw < 0 };
}

/** 파트너 본인 상품 목록(관리자 조회는 admin 경로 별도). */
export async function listMyProducts(
  partnerUserId: string,
): Promise<ProductRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_products")
    .select("*")
    .eq("partner_user_id", partnerUserId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getMyProduct(
  partnerUserId: string,
  id: string,
): Promise<ProductRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_products")
    .select("*")
    .eq("id", id)
    .eq("partner_user_id", partnerUserId)
    .maybeSingle();
  return data ?? null;
}

export interface ProductInput {
  id?: string;
  name: string;
  description?: string | null;
  includedServices?: string | null;
  basePlan?: "basic" | "pro" | null;
  sellPriceKrw: number;
  vatMode?: VatMode;
  billingType?: BillingType;
  billingPeriod?: "monthly" | null;
  validFrom?: string | null;
  validUntil?: string | null;
  scope?: string | null;
  terms?: string | null;
  status?: "draft" | "active" | "archived";
  sortOrder?: number;
}

/**
 * 파트너 상품 생성/수정 — 호출 전 isCurrentUserPartner 확인. 세션 RLS 클라이언트(파트너 본인).
 * 기본요금은 저장 시점의 plans.ts 값을 스냅샷(base_price_krw, base_plan_version)한다.
 * 판매가 하한은 두지 않는다(판매가<기본요금은 UI 경고만).
 */
export async function upsertProduct(
  partnerUserId: string,
  input: ProductInput,
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const basePlan = input.basePlan ?? null;
  const basePrice = basePriceForPlan(basePlan);
  const sell = Math.max(0, Math.floor(input.sellPriceKrw));

  const row = {
    partner_user_id: partnerUserId,
    name: input.name.trim(),
    description: input.description ?? null,
    included_services: input.includedServices ?? null,
    base_plan: basePlan,
    base_plan_version: PLAN_PRICE_VERSION,
    base_price_krw: basePrice,
    sell_price_krw: sell,
    vat_mode: input.vatMode ?? "included",
    billing_type: input.billingType ?? "one_time",
    billing_period:
      input.billingType === "recurring"
        ? (input.billingPeriod ?? "monthly")
        : null,
    valid_from: input.validFrom ?? null,
    valid_until: input.validUntil ?? null,
    scope: input.scope ?? null,
    terms: input.terms ?? null,
    status: input.status ?? "draft",
    sort_order: input.sortOrder ?? 100,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("partner_products")
      .update(row)
      .eq("id", input.id)
      .eq("partner_user_id", partnerUserId);
    if (error) {
      console.error("[b2b2c] product update failed", error);
      return { error: "상품 저장에 실패했습니다." };
    }
    return { id: input.id };
  }

  const { data, error } = await supabase
    .from("partner_products")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) {
    console.error("[b2b2c] product insert failed", error);
    return { error: "상품 생성에 실패했습니다." };
  }
  return { id: data.id };
}

export async function setProductStatus(
  partnerUserId: string,
  id: string,
  status: "draft" | "active" | "archived",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_products")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("partner_user_id", partnerUserId);
  if (error) return { error: "상태 변경에 실패했습니다." };
  return {};
}
