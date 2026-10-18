"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/queries";
import {
  upsertOwnSupporterProfile,
  type SupporterProfileInput,
} from "@/lib/supporters";

/** 서포터즈 신청/프로필 저장 — 누구나(로그인) 신청, 신규는 pending(관리자 승인 대기). */
export async function applySupporterAction(
  input: SupporterProfileInput,
): Promise<{ ok?: boolean; error?: string; status?: string }> {
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const res = await upsertOwnSupporterProfile(user.id, input);
  if (res.ok) revalidatePath("/dashboard/supporters/apply");
  return res;
}
