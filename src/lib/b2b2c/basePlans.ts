import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { getPlanById, planFeatureList, type PlanId } from "@/lib/plans";
import type { SellableBasePlan } from "./config";

/**
 * 본사 기본상품(공급가) 카탈로그 — 파트너가 상품을 만들 때 참조하는 "본사가 제공하는 기준 요금제"의
 * 공개용 정보. 관리자가 base_plan_catalog 테이블에서 직접 수정한다(0097).
 *
 * 테이블 행이 있으면 그 값을, 없으면(미마이그레이션 환경 포함) plans.ts 상수로 폴백한다.
 * 이 모듈은 운영 중 테이블이 비어 있거나 없어도 절대 던지지 않고 기본값을 돌려준다.
 */
export interface BasePlanInfo {
  plan: SellableBasePlan;
  displayName: string;
  /** 본사 공급가(원) — 정산 시 본사 공제 기준. */
  supplyPriceKrw: number;
  summary: string | null;
  /** 상세 포함 내역(줄바꿈 구분 불릿). */
  includedServices: string | null;
  /** db = 관리자 설정값, default = plans.ts 폴백. */
  source: "db" | "default";
}

const SELLABLE: SellableBasePlan[] = ["basic", "pro"];

/** plans.ts 기준 기본값(폴백). */
function defaultInfo(plan: SellableBasePlan): BasePlanInfo {
  const p = getPlanById(plan as PlanId);
  return {
    plan,
    displayName: `STORYUP ${p.name.en}`,
    supplyPriceKrw: p.priceKrw ?? 0,
    summary: null,
    includedServices: planFeatureList(p, true).join("\n"),
    source: "default",
  };
}

/** basic/pro 전체 카탈로그(관리자 설정값 우선, 없으면 plans.ts). */
export async function getBasePlanCatalog(): Promise<
  Record<SellableBasePlan, BasePlanInfo>
> {
  const out: Record<SellableBasePlan, BasePlanInfo> = {
    basic: defaultInfo("basic"),
    pro: defaultInfo("pro"),
  };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("base_plan_catalog")
    .select("*")
    .in("plan", SELLABLE);
  if (error || !data) return out; // 테이블 없음/오류 → 폴백 유지
  for (const r of data) {
    if (r.plan !== "basic" && r.plan !== "pro") continue;
    out[r.plan] = {
      plan: r.plan,
      displayName: r.display_name,
      supplyPriceKrw: r.supply_price_krw,
      summary: r.summary,
      includedServices: r.included_services,
      source: "db",
    };
  }
  return out;
}

/** 단일 플랜 정보(커스텀/미연동이면 null). */
export async function getBasePlanInfo(
  plan: string | null,
): Promise<BasePlanInfo | null> {
  if (plan !== "basic" && plan !== "pro") return null;
  const catalog = await getBasePlanCatalog();
  return catalog[plan];
}

/**
 * 파트너 상품 저장 시 스냅샷할 본사 공급가(원). 관리자 설정값 우선, 없으면 plans.ts.
 * 요금제 미연동(null)·알 수 없는 플랜이면 0.
 */
export async function supplyPriceForPlan(plan: string | null): Promise<number> {
  const info = await getBasePlanInfo(plan);
  return info?.supplyPriceKrw ?? 0;
}

export interface BasePlanCatalogInput {
  plan: SellableBasePlan;
  displayName: string;
  supplyPriceKrw: number;
  summary?: string | null;
  includedServices?: string | null;
}

/**
 * 관리자 전용 — 본사 기본상품 정보 수정/업서트. 호출 전 isCurrentUserAdmin() 확인.
 * 서비스롤로 저장(RLS 쓰기 정책 없음).
 */
export async function upsertBasePlanCatalog(
  input: BasePlanCatalogInput,
  adminUserId: string,
): Promise<{ error?: string }> {
  if (input.plan !== "basic" && input.plan !== "pro") {
    return { error: "알 수 없는 요금제입니다." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("base_plan_catalog").upsert(
    {
      plan: input.plan,
      display_name: input.displayName.trim() || `STORYUP ${input.plan}`,
      supply_price_krw: Math.max(0, Math.floor(input.supplyPriceKrw)),
      summary: input.summary?.trim() || null,
      included_services: input.includedServices?.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: adminUserId,
    },
    { onConflict: "plan" },
  );
  if (error) {
    console.error("[b2b2c] base_plan_catalog upsert failed", error);
    return { error: "본사 기본상품 저장에 실패했습니다." };
  }
  return {};
}
