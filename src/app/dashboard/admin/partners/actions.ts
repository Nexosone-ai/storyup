"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/points";
import { grantPartnerCredits } from "@/lib/partner";
import { setUserPlanAction } from "@/app/dashboard/admin/actions";

export interface PartnerAdminState {
  ok?: boolean;
  error?: string;
  message?: string;
}

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
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

/** 파트너 플랜 부여(= 파트너 자격). 기존 관리자 플랜 설정 재사용. */
export async function makePartnerAction(
  email: string,
): Promise<PartnerAdminState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const res = await setUserPlanAction(email, "partner");
  return res.error
    ? { error: res.error }
    : { ok: true, message: res.message ?? "파트너로 설정했어요." };
}

/** 파트너 ↔ 고객(사업주) 배정. 두 이메일 모두 가입 사용자여야 함. */
export async function assignClientAction(
  partnerEmail: string,
  clientEmail: string,
): Promise<PartnerAdminState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const [partnerId, clientId] = await Promise.all([
    userIdByEmail(partnerEmail),
    userIdByEmail(clientEmail),
  ]);
  if (!partnerId) return { error: "파트너 이메일의 사용자를 찾을 수 없습니다." };
  if (!clientId) return { error: "고객 이메일의 사용자를 찾을 수 없습니다." };
  if (partnerId === clientId)
    return { error: "파트너와 고객이 같을 수 없습니다." };

  const me_ = await me();
  const admin = createAdminClient();
  const { error } = await admin.from("partner_clients").insert({
    partner_user_id: partnerId,
    client_user_id: clientId,
    created_by: me_?.id ?? null,
  });
  if (error)
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "이미 배정된 조합입니다."
        : "배정에 실패했습니다.",
    };
  revalidatePath("/dashboard/admin/partners");
  return { ok: true, message: "고객을 배정했어요." };
}

export async function unassignClientAction(
  id: string,
): Promise<PartnerAdminState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const admin = createAdminClient();
  await admin.from("partner_clients").delete().eq("id", id);
  revalidatePath("/dashboard/admin/partners");
  return { ok: true, message: "배정을 해제했어요." };
}

/** 파트너에게 패킷(크레딧) 지급. */
export async function grantCreditsAction(
  partnerEmail: string,
  amount: number,
  memo: string,
): Promise<PartnerAdminState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  if (!Number.isInteger(amount) || amount === 0)
    return { error: "지급할 크레딧(0 아님)을 입력해주세요." };
  const partnerId = await userIdByEmail(partnerEmail);
  if (!partnerId) return { error: "파트너 이메일의 사용자를 찾을 수 없습니다." };
  const me_ = await me();
  await grantPartnerCredits(
    partnerId,
    amount,
    memo.trim() || (amount > 0 ? "관리자 지급" : "관리자 차감"),
    me_?.id ?? null,
  );
  revalidatePath("/dashboard/admin/partners");
  return {
    ok: true,
    message: `${partnerEmail}에게 ${amount.toLocaleString()} 크레딧 반영했어요.`,
  };
}

/** 작업별 크레딧 단가 변경. */
export async function setCreditPriceAction(
  action: string,
  credits: number,
  active: boolean,
): Promise<PartnerAdminState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  if (!Number.isInteger(credits) || credits < 0)
    return { error: "크레딧은 0 이상 정수여야 합니다." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("partner_credit_prices")
    .update({ credits, active, updated_at: new Date().toISOString() })
    .eq("action", action);
  if (error) return { error: "단가 저장에 실패했습니다." };
  revalidatePath("/dashboard/admin/partners");
  return { ok: true, message: "단가를 저장했어요." };
}
