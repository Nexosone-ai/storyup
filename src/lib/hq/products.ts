import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import {
  parseEntitlementItems,
  type EntitlementItem,
  type GrantablePlan,
} from "@/lib/partner/entitlementCatalog";
import type { VatMode, BillingType } from "@/lib/b2b2c/config";

/**
 * 본사 상품(hq_products) — 관리자가 등록하는 파트너 판매용 상품(0112). base_plan_catalog 대체.
 * 파트너는 이 상품에 마진을 붙여 상품을 만들고(upsertProduct 가 공급가·제공 항목을 스냅샷),
 * 고객 결제 시 grant_plan(고객 플랜)과 items(파트너 작업권)가 자동 지급된다.
 * 공급가는 파트너 화면에 노출하지 않는다 — 호출부가 supplyPriceKrw 를 떼고 내려보낼 것.
 */
export interface HqProduct {
  id: string;
  key: string;
  name: string;
  description: string | null;
  includedServices: string | null;
  /** 본사 공급가(원, 부가세 별도) — 정산 시 본사 공제 기준. 파트너 비노출. */
  supplyPriceKrw: number;
  vatMode: VatMode;
  billingType: BillingType;
  billingPeriod: "monthly" | null;
  grantPlan: GrantablePlan | null;
  grantDays: number;
  items: EntitlementItem[];
  status: "draft" | "active" | "archived";
  sortOrder: number;
  updatedAt: string;
}

/** 파트너에게 내려보내는 형태(공급가 제외). */
export type HqProductForPartner = Omit<HqProduct, "supplyPriceKrw">;

export function stripSupplyPrice(p: HqProduct): HqProductForPartner {
  const { supplyPriceKrw: _supply, ...rest } = p;
  void _supply;
  return rest;
}

type Row = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  included_services: string | null;
  supply_price_krw: number;
  vat_mode: string;
  billing_type: string;
  billing_period: string | null;
  grant_plan: string | null;
  grant_days: number;
  status: string;
  sort_order: number;
  updated_at: string;
};

function toProduct(r: Row, items: EntitlementItem[]): HqProduct {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    includedServices: r.included_services,
    supplyPriceKrw: r.supply_price_krw,
    vatMode: r.vat_mode === "included" ? "included" : "excluded",
    billingType: r.billing_type === "recurring" ? "recurring" : "one_time",
    billingPeriod: r.billing_period === "monthly" ? "monthly" : null,
    grantPlan:
      r.grant_plan === "basic" || r.grant_plan === "pro" || r.grant_plan === "lite"
        ? r.grant_plan
        : null,
    grantDays: r.grant_days,
    items,
    status:
      r.status === "active" || r.status === "archived" ? r.status : "draft",
    sortOrder: r.sort_order,
    updatedAt: r.updated_at,
  };
}

async function itemsFor(ids: string[]): Promise<Map<string, EntitlementItem[]>> {
  const map = new Map<string, EntitlementItem[]>();
  if (ids.length === 0) return map;
  const admin = createAdminClient();
  const { data } = await admin
    .from("hq_product_items")
    .select("hq_product_id, service_key, units")
    .in("hq_product_id", ids);
  for (const it of data ?? []) {
    const arr = map.get(it.hq_product_id) ?? [];
    arr.push(...parseEntitlementItems([{ serviceKey: it.service_key, units: it.units }]));
    map.set(it.hq_product_id, arr);
  }
  return map;
}

/** 본사 상품 목록(activeOnly = 파트너용). 테이블이 없으면(0112 전) 빈 배열. */
export async function listHqProducts(opts: { activeOnly?: boolean } = {}): Promise<HqProduct[]> {
  const admin = createAdminClient();
  let q = admin
    .from("hq_products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (opts.activeOnly) q = q.eq("status", "active");
  const { data, error } = await q;
  if (error || !data) return [];
  const items = await itemsFor(data.map((r) => r.id));
  return data.map((r) => toProduct(r as Row, items.get(r.id) ?? []));
}

/** id 또는 key 로 1건(상태 무관). */
export async function getHqProduct(idOrKey: string): Promise<HqProduct | null> {
  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrKey);
  const { data } = await admin
    .from("hq_products")
    .select("*")
    .eq(isUuid ? "id" : "key", idOrKey)
    .maybeSingle();
  if (!data) return null;
  const items = await itemsFor([data.id]);
  return toProduct(data as Row, items.get(data.id) ?? []);
}

export interface HqProductInput {
  id?: string;
  key?: string;
  name: string;
  description?: string | null;
  includedServices?: string | null;
  supplyPriceKrw: number;
  vatMode?: VatMode;
  billingType?: BillingType;
  grantPlan?: GrantablePlan | null;
  grantDays?: number;
  items?: EntitlementItem[];
  status?: "draft" | "active" | "archived";
  sortOrder?: number;
}

function slugKey(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${base || "product"}_${Date.now().toString(36)}`;
}

/** 관리자 전용 — 본사 상품 생성/수정(서비스롤). 호출 전 isCurrentUserAdmin() 확인. */
export async function upsertHqProduct(
  input: HqProductInput,
  adminUserId: string | null,
): Promise<{ id?: string; error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "상품명을 입력해주세요." };
  const supply = Math.floor(input.supplyPriceKrw);
  if (!Number.isFinite(supply) || supply < 0) return { error: "공급가를 올바르게 입력해주세요." };
  const days = Math.floor(input.grantDays ?? 30);
  if (input.grantPlan && (days < 1 || days > 365)) return { error: "플랜 기간은 1~365일이어야 해요." };
  const items = parseEntitlementItems(input.items ?? []);
  if ((input.items ?? []).length !== items.length)
    return { error: "작업권 항목이 올바르지 않아요(같은 서비스 중복 또는 수량 1 미만)." };

  const admin = createAdminClient();
  const row = {
    name,
    description: input.description?.trim() || null,
    included_services: input.includedServices?.trim() || null,
    supply_price_krw: supply,
    vat_mode: input.vatMode ?? "excluded",
    billing_type: input.billingType ?? "one_time",
    billing_period: input.billingType === "recurring" ? "monthly" : null,
    grant_plan: input.grantPlan ?? null,
    grant_days: days > 0 ? days : 30,
    status: input.status ?? "draft",
    sort_order: Math.floor(input.sortOrder ?? 100),
    updated_by: adminUserId,
    updated_at: new Date().toISOString(),
  };

  let id = input.id ?? null;
  if (id) {
    const { error } = await admin.from("hq_products").update(row).eq("id", id);
    if (error) {
      console.error("[hq] product update failed", error);
      return { error: "본사 상품 저장에 실패했어요." };
    }
  } else {
    const { data, error } = await admin
      .from("hq_products")
      .insert({ ...row, key: input.key?.trim() || slugKey(name) })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[hq] product insert failed", error);
      return { error: "본사 상품 생성에 실패했어요." };
    }
    id = data.id;
  }

  // 제공 항목은 전체 교체.
  await admin.from("hq_product_items").delete().eq("hq_product_id", id);
  if (items.length > 0) {
    const { error } = await admin.from("hq_product_items").insert(
      items.map((it) => ({ hq_product_id: id!, service_key: it.serviceKey, units: it.units })),
    );
    if (error) {
      console.error("[hq] product items insert failed", error);
      return { id, error: "제공 항목 저장에 실패했어요. 다시 저장해주세요." };
    }
  }
  return { id };
}

/** 관리자 전용 — 상태 변경(판매 시작/중지/보관). 삭제는 없음(연결된 파트너 상품·청구서 보존). */
export async function setHqProductStatus(
  id: string,
  status: "draft" | "active" | "archived",
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("hq_products")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "상태 변경에 실패했어요." };
  return {};
}
