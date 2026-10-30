import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { secureToken } from "./secure";
import type { Database } from "@/types/database";

export type OfferRow = Database["public"]["Tables"]["partner_offers"]["Row"];

/** 고객(공개)용 오퍼 뷰 — 기본요금·마진을 절대 포함하지 않는다. 최종 판매가만 노출. */
export interface PublicOffer {
  token: string;
  name: string;
  description: string | null;
  includedServices: string | null;
  sellPriceKrw: number;
  currency: string;
  vatMode: string;
  billingType: string;
  billingPeriod: string | null;
  validUntil: string | null;
  status: string;
  partnerUserId: string;
}

/** 고객에게 노출 가능한 필드만 추린다(base_* 제거). */
export function toPublicOffer(r: OfferRow): PublicOffer {
  return {
    token: r.token,
    name: r.name,
    description: r.description,
    includedServices: r.included_services,
    sellPriceKrw: r.sell_price_krw,
    currency: r.currency,
    vatMode: r.vat_mode,
    billingType: r.billing_type,
    billingPeriod: r.billing_period,
    validUntil: r.valid_until,
    status: r.status,
    partnerUserId: r.partner_user_id,
  };
}

export async function listMyOffers(partnerUserId: string): Promise<OfferRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_offers")
    .select("*")
    .eq("partner_user_id", partnerUserId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export interface CreateOfferInput {
  productId: string;
  clientUserId?: string | null;
  /** 고객별 가격 조정(미지정 시 상품 판매가 사용). */
  sellPriceKrw?: number | null;
  /** 오퍼 만료(일). 미지정 시 만료 없음. */
  validDays?: number | null;
}

/**
 * 상품을 고객에게 제시(오퍼). 호출 전 isCurrentUserPartner 확인. 상품의 모든 값을 스냅샷해
 * 이후 상품 변경과 무관하게 한다. 토큰은 추측 불가, 상태 'sent'.
 */
export async function createOffer(
  partnerUserId: string,
  input: CreateOfferInput,
): Promise<{ offer?: OfferRow; error?: string }> {
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("partner_products")
    .select("*")
    .eq("id", input.productId)
    .eq("partner_user_id", partnerUserId)
    .maybeSingle();
  if (!product) return { error: "상품을 찾을 수 없습니다." };

  const sell =
    input.sellPriceKrw != null
      ? Math.max(0, Math.floor(input.sellPriceKrw))
      : product.sell_price_krw;

  const validUntil =
    input.validDays && input.validDays > 0
      ? new Date(Date.now() + input.validDays * 86_400_000).toISOString()
      : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_offers")
    .insert({
      partner_user_id: partnerUserId,
      client_user_id: input.clientUserId ?? null,
      product_id: product.id,
      token: secureToken(),
      name: product.name,
      description: product.description,
      included_services: product.included_services,
      base_plan: product.base_plan,
      base_plan_version: product.base_plan_version,
      base_price_krw: product.base_price_krw,
      sell_price_krw: sell,
      currency: product.currency,
      vat_mode: product.vat_mode,
      billing_type: product.billing_type,
      billing_period: product.billing_period,
      valid_until: validUntil,
      status: "sent",
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[b2b2c] offer create failed", error);
    return { error: "오퍼 생성에 실패했습니다." };
  }
  return { offer: data };
}

/** 공개 토큰으로 오퍼 조회(서비스롤). 만료 반영. 내부 필드 포함(호출부에서 toPublicOffer로 정제). */
export async function getOfferByToken(token: string): Promise<OfferRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_offers")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  // 만료 처리(조회 시 자연 만료 표시 — 상태는 그대로 두되 노출만 expired).
  if (
    data.status === "sent" &&
    data.valid_until &&
    new Date(data.valid_until).getTime() < Date.now()
  ) {
    return { ...data, status: "expired" };
  }
  return data;
}

export async function voidOffer(
  partnerUserId: string,
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_offers")
    .update({ status: "void", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("partner_user_id", partnerUserId);
  if (error) return { error: "오퍼 취소에 실패했습니다." };
  return {};
}
