import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { MARKETPLACE_ENABLED } from "./config";

/**
 * 디자이너 권한 — 파트너 계정 내 '별도' 권한(파트너 AI Agent 자동화와 독립).
 * designer_permissions(status='active')로 판별. 관리자만 부여/취소.
 * 1단계: 플래그 비활성 시 항상 false(노출 없음).
 */

export async function isDesigner(userId: string): Promise<boolean> {
  if (!MARKETPLACE_ENABLED) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("designer_permissions")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.status === "active";
  } catch {
    return false;
  }
}

export async function isCurrentUserDesigner(): Promise<boolean> {
  if (!MARKETPLACE_ENABLED) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return isDesigner(user.id);
}

/** 관리자 — 디자이너 권한 부여(멱등). 서버에서 is_admin 확인은 호출부가 보장. */
export async function grantDesigner(
  userId: string,
  grantedBy: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("designer_permissions")
    .upsert(
      { user_id: userId, granted_by: grantedBy, status: "active" },
      { onConflict: "user_id" },
    );
}

/** 관리자 — 디자이너 권한 취소(행 유지, status=revoked). */
export async function revokeDesigner(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("designer_permissions")
    .update({ status: "revoked" })
    .eq("user_id", userId);
}
