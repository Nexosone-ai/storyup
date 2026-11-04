"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/queries";
import {
  isCurrentUserPartner,
  isSubPartner,
  inviteSubPartner,
  setSubPartnerStatus,
} from "@/lib/partner";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";

/**
 * 상위파트너 전용 가드 — 로그인 + partner 플랜 + 기능 플래그 + '서브가 아님'.
 * 서브파트너는 또 서브를 만들 수 없다(깊이 2단계). 반환 null이면 권한 없음.
 */
async function requireTopPartner(): Promise<string | null> {
  if (!B2B2C_ENABLED) return null;
  const user = await getUser();
  if (!user) return null;
  if (!(await isCurrentUserPartner())) return null;
  if (await isSubPartner(user.id)) return null;
  return user.id;
}

export async function inviteSubPartnerAction(
  email: string,
): Promise<{ ok?: boolean; error?: string }> {
  const uid = await requireTopPartner();
  if (!uid) return { error: "권한이 없습니다." };
  const { subUserId, error } = await inviteSubPartner(uid, email);
  if (error || !subUserId) return { error: error ?? "등록에 실패했습니다." };
  revalidatePath("/partner/sub-partners");
  return { ok: true };
}

export async function setSubPartnerStatusAction(
  subUserId: string,
  status: "active" | "suspended",
): Promise<{ ok?: boolean; error?: string }> {
  const uid = await requireTopPartner();
  if (!uid) return { error: "권한이 없습니다." };
  const { error } = await setSubPartnerStatus(uid, subUserId, status);
  if (error) return { error };
  revalidatePath("/partner/sub-partners");
  return { ok: true };
}
