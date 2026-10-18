"use server";

import { revalidatePath } from "next/cache";
import {
  createAgencyInquiry,
  sendAgencyMessage,
  createQuote,
} from "@/lib/agency";

/** 클라이언트: 서포터즈에서 대행 문의 생성(배정 파트너 자동 매칭). */
export async function createInquiryAction(
  businessId: string,
  serviceKey: string,
  message: string,
): Promise<{ id?: string; error?: string }> {
  const res = await createAgencyInquiry({ businessId, serviceKey, message });
  if (res.id) revalidatePath("/dashboard/supporters");
  return res;
}

/** 스레드 메시지 전송(클라/파트너 공용). */
export async function sendMessageAction(
  inquiryId: string,
  body: string,
): Promise<{ ok?: boolean; error?: string }> {
  const res = await sendAgencyMessage(inquiryId, body);
  if (res.ok) revalidatePath(`/dashboard/agency/${inquiryId}`);
  return res;
}

/** 파트너: 견적(공급가+마진) → 결제코드 발행. */
export async function createQuoteAction(
  inquiryId: string,
  clientPriceKrw: number,
): Promise<{ code?: string; error?: string }> {
  const res = await createQuote({ inquiryId, clientPriceKrw });
  if (res.code) revalidatePath(`/dashboard/agency/${inquiryId}`);
  return res;
}
