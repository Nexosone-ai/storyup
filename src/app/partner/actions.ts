"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/queries";
import { isPartner } from "@/lib/partner";
import {
  upsertOwnSupporterProfile,
  type SupporterProfileInput,
} from "@/lib/supporters";

/** 파트너 본인 프로필(작업 현황·이력) 저장. */
export async function savePartnerProfileAction(
  input: SupporterProfileInput,
): Promise<{ ok?: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!(await isPartner(user.id)))
    return { error: "파트너만 프로필을 등록할 수 있어요." };
  const res = await upsertOwnSupporterProfile(user.id, input);
  if (res.ok) revalidatePath("/partner");
  return res;
}
