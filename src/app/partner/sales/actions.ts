"use server";

import { getUser } from "@/lib/queries";
import { isCurrentUserPartner } from "@/lib/partner";
import { B2B2C_ENABLED, type VatMode, type BillingType } from "@/lib/b2b2c/config";
import { upsertStorefront, type StorefrontInput } from "@/lib/b2b2c/storefront";
import {
  upsertProduct,
  setProductStatus,
  type ProductInput,
} from "@/lib/b2b2c/products";
import { createOffer, voidOffer } from "@/lib/b2b2c/offers";
import { issueInvoiceFromOffer, voidInvoice } from "@/lib/b2b2c/invoices";

/** 파트너 전용 가드 — 로그인 + partner 플랜 + 기능 플래그. 반환 null이면 권한 없음. */
async function requirePartner(): Promise<string | null> {
  if (!B2B2C_ENABLED) return null;
  const user = await getUser();
  if (!user) return null;
  if (!(await isCurrentUserPartner())) return null;
  return user.id;
}

export async function saveStorefrontAction(
  input: StorefrontInput,
): Promise<{ slug?: string; error?: string }> {
  const uid = await requirePartner();
  if (!uid) return { error: "권한이 없습니다." };
  if (!input.displayName?.trim()) return { error: "스토어 이름을 입력해주세요." };
  return upsertStorefront(uid, input);
}

export async function saveProductAction(
  input: ProductInput,
): Promise<{ id?: string; error?: string }> {
  const uid = await requirePartner();
  if (!uid) return { error: "권한이 없습니다." };
  if (!input.name?.trim()) return { error: "상품명을 입력해주세요." };
  if (!Number.isFinite(input.sellPriceKrw) || input.sellPriceKrw < 0)
    return { error: "판매가를 올바르게 입력해주세요." };
  return upsertProduct(uid, {
    ...input,
    vatMode: input.vatMode as VatMode | undefined,
    billingType: input.billingType as BillingType | undefined,
  });
}

export async function setProductStatusAction(
  id: string,
  status: "draft" | "active" | "archived",
): Promise<{ error?: string }> {
  const uid = await requirePartner();
  if (!uid) return { error: "권한이 없습니다." };
  return setProductStatus(uid, id, status);
}

export async function createOfferAction(input: {
  productId: string;
  clientUserId?: string | null;
  sellPriceKrw?: number | null;
  validDays?: number | null;
}): Promise<{ token?: string; error?: string }> {
  const uid = await requirePartner();
  if (!uid) return { error: "권한이 없습니다." };
  const { offer, error } = await createOffer(uid, input);
  if (error || !offer) return { error: error ?? "오퍼 생성 실패" };
  return { token: offer.token };
}

export async function voidOfferAction(id: string): Promise<{ error?: string }> {
  const uid = await requirePartner();
  if (!uid) return { error: "권한이 없습니다." };
  return voidOffer(uid, id);
}

export async function issueInvoiceAction(input: {
  offerId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  taxKrw?: number | null;
  sellerName?: string | null;
  sellerInfo?: string | null;
}): Promise<{ token?: string; error?: string }> {
  const uid = await requirePartner();
  if (!uid) return { error: "권한이 없습니다." };
  const { invoice, error } = await issueInvoiceFromOffer(uid, input);
  if (error || !invoice) return { error: error ?? "청구서 발행 실패" };
  return { token: invoice.token };
}

export async function voidInvoiceAction(
  id: string,
): Promise<{ error?: string }> {
  const uid = await requirePartner();
  if (!uid) return { error: "권한이 없습니다." };
  return voidInvoice(uid, id);
}
