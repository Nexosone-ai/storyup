"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import { approveFreeReapply, rejectFreeReapply } from "@/lib/freeAccess";

export interface FreeApprovalState {
  ok?: boolean;
  error?: string;
}

/** 관리자 — 무료 재신청 승인(1개월 이용 재개). */
export async function approveFreeReapplyAction(
  grantId: string,
): Promise<FreeApprovalState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const res = await approveFreeReapply(grantId, user.id);
  if (res.ok) revalidatePath("/dashboard/admin/free-approvals");
  return res;
}

/** 관리자 — 무료 재신청 반려. */
export async function rejectFreeReapplyAction(
  grantId: string,
): Promise<FreeApprovalState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const res = await rejectFreeReapply(grantId);
  if (res.ok) revalidatePath("/dashboard/admin/free-approvals");
  return res;
}
