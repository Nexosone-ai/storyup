"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/points";

export interface AdminDomainState {
  ok?: boolean;
  error?: string;
}

/**
 * 관리자 — 커스텀 도메인 상태 변경.
 * 실제 Vercel 프로젝트에 도메인을 추가하고 DNS/SSL 확인 후 'active'로 전환한다.
 */
export async function setDomainStatusAction(
  domainId: string,
  status: "pending" | "active" | "error",
): Promise<AdminDomainState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("custom_domains")
    .update({
      status,
      verified_at: status === "active" ? new Date().toISOString() : null,
    })
    .eq("id", domainId);
  if (error) return { error: "상태 변경에 실패했습니다." };

  revalidatePath("/dashboard/admin/domains");
  return { ok: true };
}
