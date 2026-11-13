import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PLAN_PRICE_VERSION, type VatMode, type BillingType } from "./config";
import { parentPartnerOf } from "@/lib/partner";
import { getHqProduct } from "@/lib/hq/products";
import {
  parseEntitlementItems,
  type EntitlementItem,
  type GrantablePlan,
} from "@/lib/partner/entitlementCatalog";
import type { Database, Json } from "@/types/database";

export type ProductRow =
  Database["public"]["Tables"]["partner_products"]["Row"];

/** 공개 스토어프론트에 노출하는 상품(고객 셀프 구매용) — 기본요금·마진 비노출, 판매가만. */
export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  includedServices: string | null;
  basePlan: GrantablePlan | null;
  sellPriceKrw: number;
  currency: string;
  vatMode: string;
  billingType: string;
  billingPeriod: string | null;
}

function toPublicProduct(r: ProductRow): PublicProduct {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    includedServices: r.included_services,
    basePlan: (r.base_plan as GrantablePlan | null) ?? null,
    sellPriceKrw: r.sell_price_krw,
    currency: r.currency,
    vatMode: r.vat_mode,
    billingType: r.billing_type,
    billingPeriod: r.billing_period,
  };
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

/**
 * 공개 스토어프론트용 — 특정 파트너(slug)의 '활성' 상품을 고객에게 노출(셀프 구매).
 * 스토어프론트가 active 일 때만. draft/보관 상품과 hidden 스토어는 제외. 서비스롤 안전필드만.
 */
export async function listPublicProductsBySlug(
  slug: string,
): Promise<{ partnerUserId: string; products: PublicProduct[] } | null> {
  const admin = createAdminClient();
  const { data: store } = await admin
    .from("partner_storefronts")
    .select("partner_user_id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!store) return null;
  const { data } = await admin
    .from("partner_products")
    .select("*")
    .eq("partner_user_id", store.partner_user_id)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return {
    partnerUserId: store.partner_user_id,
    products: (data ?? []).map(toPublicProduct),
  };
}

export interface ProductInput {
  id?: string;
  name: string;
  description?: string | null;
  includedServices?: string | null;
  /** 결제 시 고객에게 주는 플랜(본사 상품의 grant_plan). hqProductId 가 있으면 거기서 결정된다. */
  basePlan?: GrantablePlan | null;
  /** 본사 상품 id(0112). 없고 basePlan 만 오면 key=basePlan 인 본사 상품으로 해석한다. */
  hqProductId?: string | null;
  /** 서브파트너 상품 — 상위파트너의 활성 상품 id. 있으면 그 상품 판매가를 원가로 삼는다. */
  parentProductId?: string | null;
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
 * 서브파트너가 상품의 '원가'로 선택할 수 있는 상위파트너의 활성 상품 목록.
 * 상위파트너가 없으면(일반 파트너) 빈 배열 — 호출부가 본사 요금제 선택으로 폴백.
 */
export async function listParentProductsFor(
  subUserId: string,
): Promise<PublicProduct[]> {
  const parentId = await parentPartnerOf(subUserId);
  if (!parentId) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_products")
    .select("*")
    .eq("partner_user_id", parentId)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return (data ?? []).map(toPublicProduct);
}

/**
 * 파트너 상품 생성/수정 — 호출 전 isCurrentUserPartner 확인. 세션 RLS 클라이언트(파트너 본인).
 * 원가는 저장 시점의 본사 상품 공급가(서브는 상위 판매가)를 스냅샷(base_price_krw)한다.
 * 판매가 하한은 두지 않는다(판매가<기본요금은 UI 경고만).
 */
export async function upsertProduct(
  partnerUserId: string,
  input: ProductInput,
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const sell = Math.max(0, Math.floor(input.sellPriceKrw));

  // 서브파트너 상품: 상위파트너의 활성 상품을 '원가'로 삼는다(가격 스냅샷 체인).
  //  base_price_krw        = 상위 판매가(서브의 원가)
  //  parent_base_price_krw = 본사 공급가(상위의 원가 스냅샷)
  //  parent_partner_user_id/parent_product_id = 상위 참조(정산 분배용)
  let basePlan: GrantablePlan | null = input.basePlan ?? null;
  let basePrice: number;
  let parentPartnerUserId: string | null = null;
  let parentProductId: string | null = null;
  let parentBasePriceKrw: number | null = null;
  // 0112 — 본사 상품 참조 + 결제 시 제공(플랜 기간·작업권) 스냅샷. 서브는 상위 상품에서 복사.
  let hqProductId: string | null = null;
  let grantDays = 30;
  let entitlements: EntitlementItem[] = [];

  if (input.parentProductId) {
    const admin = createAdminClient();
    const { data: parentProduct } = await admin
      .from("partner_products")
      .select("*")
      .eq("id", input.parentProductId)
      .eq("status", "active")
      .maybeSingle();
    if (!parentProduct)
      return { error: "선택한 상위파트너 상품을 찾을 수 없습니다." };
    // 보안 — 상위 상품이 내 상위파트너의 것이어야 한다.
    const myParent = await parentPartnerOf(partnerUserId);
    if (!myParent || parentProduct.partner_user_id !== myParent)
      return { error: "상위파트너 상품만 원가로 선택할 수 있습니다." };

    basePlan = (parentProduct.base_plan as GrantablePlan | null) ?? null;
    basePrice = parentProduct.sell_price_krw; // 서브 원가 = 상위 판매가
    parentPartnerUserId = parentProduct.partner_user_id;
    parentProductId = parentProduct.id;
    parentBasePriceKrw = parentProduct.base_price_krw; // 본사 공급가 스냅샷
    hqProductId = parentProduct.hq_product_id ?? null;
    grantDays = parentProduct.grant_days ?? 30;
    entitlements = parseEntitlementItems(parentProduct.entitlements);
  } else {
    // 서브파트너는 상위파트너 상품만 원가로 쓸 수 있다 — 본사 공급가 경로 차단
    // (화면에서도 숨기지만, 직접 호출로 공급가를 스냅샷·노출하는 것을 서버에서 막는다).
    if (await parentPartnerOf(partnerUserId))
      return { error: "서브파트너는 상위파트너 상품을 원가로 선택해야 합니다." };
    // 일반 파트너 — 본사 상품(hq_products, 필수)에서 공급가·제공 항목을 스냅샷(PR3: 커스텀 폐지).
    // hqProductId 가 없고 basePlan(basic|pro)만 오면 같은 key 의 본사 상품으로 해석(구 호출 호환).
    const hq = input.hqProductId
      ? await getHqProduct(input.hqProductId)
      : basePlan
        ? await getHqProduct(basePlan)
        : null;
    if (!hq) return { error: "본사 상품을 선택해주세요." };
    // 판매 중지·보관된 본사 상품은 새로 연결할 수 없다. 이미 연결된 상품의 다른 항목 수정은 허용.
    if (hq.status !== "active") {
      const current = input.id
        ? await getMyProduct(partnerUserId, input.id)
        : null;
      if (!current || current.hq_product_id !== hq.id)
        return { error: "선택한 본사 상품이 판매 중이 아닙니다. 다른 본사 상품을 선택해주세요." };
    }
    hqProductId = hq.id;
    basePlan = hq.grantPlan;
    basePrice = hq.supplyPriceKrw;
    grantDays = hq.grantDays;
    entitlements = hq.items;
  }

  const row = {
    partner_user_id: partnerUserId,
    name: input.name.trim(),
    description: input.description ?? null,
    included_services: input.includedServices ?? null,
    base_plan: basePlan,
    base_plan_version: PLAN_PRICE_VERSION,
    base_price_krw: basePrice,
    parent_partner_user_id: parentPartnerUserId,
    parent_product_id: parentProductId,
    parent_base_price_krw: parentBasePriceKrw,
    hq_product_id: hqProductId,
    entitlements: entitlements as unknown as Json,
    grant_days: grantDays,
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
