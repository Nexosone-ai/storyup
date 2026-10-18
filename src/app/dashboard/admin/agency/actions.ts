"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/points";
import {
  setSupplyPrice,
  assignInquiryPartner,
  markEarningPaid,
} from "@/lib/agency";
import { setSupporterStatus } from "@/lib/supporters";

export interface AgencyAdminState {
  ok?: boolean;
  error?: string;
  message?: string;
}

async function userIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function setSupplyPriceAction(
  key: string,
  supplyPriceKrw: number,
  active: boolean,
): Promise<AgencyAdminState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  if (!Number.isInteger(supplyPriceKrw) || supplyPriceKrw < 0)
    return { error: "공급가는 0 이상 정수여야 합니다." };
  await setSupplyPrice(key, supplyPriceKrw, active);
  revalidatePath("/dashboard/admin/agency");
  return { ok: true, message: "공급가를 저장했어요." };
}

export async function assignInquiryAction(
  inquiryId: string,
  partnerEmail: string,
): Promise<AgencyAdminState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const partnerId = await userIdByEmail(partnerEmail);
  if (!partnerId) return { error: "파트너 이메일의 사용자를 찾을 수 없습니다." };
  await assignInquiryPartner(inquiryId, partnerId);
  revalidatePath("/dashboard/admin/agency");
  return { ok: true, message: "파트너를 배정했어요." };
}

export async function markEarningPaidAction(
  id: string,
): Promise<AgencyAdminState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  await markEarningPaid(id);
  revalidatePath("/dashboard/admin/agency");
  return { ok: true, message: "지급 처리했어요." };
}

/** 서포터즈 신청 승인/반려(최종 승인은 관리자). */
export async function reviewSupporterAction(
  id: string,
  approve: boolean,
): Promise<AgencyAdminState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  await setSupporterStatus(id, approve ? "active" : "rejected");
  revalidatePath("/dashboard/admin/agency");
  return { ok: true, message: approve ? "승인했어요." : "반려했어요." };
}
