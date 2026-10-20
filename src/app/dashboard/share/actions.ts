"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export interface ShareActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** 계정 소유자가 파트너를 이메일로 초대(공유). */
export async function invitePartnerShareAction(
  rawEmail: string,
): Promise<ShareActionState> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "올바른 이메일을 입력해주세요." };
  if (email === (user.email ?? "").toLowerCase())
    return { error: "본인은 초대할 수 없어요." };

  const { error } = await supabase
    .from("account_shares")
    .insert({ owner_user_id: user.id, partner_email: email, status: "pending" });
  if (error) {
    if (error.code === "23505") return { error: "이미 초대한 이메일이에요." };
    return { error: "초대에 실패했습니다." };
  }

  revalidatePath("/dashboard/share");
  return {
    ok: true,
    message: `${email} 님을 초대했어요. 상대가 같은 이메일로 로그인해 수락하면 이 계정에서 작업할 수 있어요.`,
  };
}

/** 소유자가 공유 해제(초대 취소 또는 접근 회수) — partner_clients 링크도 제거. */
export async function revokeShareAction(id: string): Promise<ShareActionState> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // RLS로 본인 소유 공유행만 조회됨.
  const { data: share } = await supabase
    .from("account_shares")
    .select("id, owner_user_id, partner_user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!share || share.owner_user_id !== user.id)
    return { error: "공유를 찾을 수 없어요." };

  const admin = createAdminClient();
  // 접근 권한(partner_clients) 삭제를 '먼저' 하고 실패하면 중단 — 권한이 남은 채
  // 공유행만 지워지는(화면엔 성공) 상황을 막는다.
  if (share.partner_user_id) {
    const { error: linkErr } = await admin
      .from("partner_clients")
      .delete()
      .eq("partner_user_id", share.partner_user_id)
      .eq("client_user_id", user.id);
    if (linkErr) {
      console.error("[share] revoke link delete failed", id, linkErr);
      return { error: "접근 권한 해제에 실패했어요. 잠시 후 다시 시도해주세요." };
    }
  }
  const { error: shareErr } = await admin.from("account_shares").delete().eq("id", id);
  if (shareErr) return { error: "공유 해제에 실패했어요." };

  revalidatePath("/dashboard/share");
  return { ok: true };
}

/** 파트너가 초대 수락 — partner_clients 링크 생성 → 소유자 사업장 접근. */
export async function acceptShareAction(id: string): Promise<ShareActionState> {
  const { user } = await sessionUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const email = (user.email ?? "").toLowerCase();
  if (!email) return { error: "이메일을 확인할 수 없어요." };

  const admin = createAdminClient();
  const { data: share } = await admin
    .from("account_shares")
    .select("id, owner_user_id, partner_email, status")
    .eq("id", id)
    .maybeSingle();
  if (!share || share.partner_email.toLowerCase() !== email || share.status !== "pending")
    return { error: "초대를 찾을 수 없어요." };
  if (share.owner_user_id === user.id)
    return { error: "본인 계정의 초대는 수락할 수 없어요." };

  // partner_clients 링크(멱등) — 이미 있으면(23505) 무시.
  const { error: linkErr } = await admin
    .from("partner_clients")
    .insert({ partner_user_id: user.id, client_user_id: share.owner_user_id });
  if (linkErr && linkErr.code !== "23505")
    return { error: "연결에 실패했습니다." };

  const { error } = await admin
    .from("account_shares")
    .update({ partner_user_id: user.id, status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "수락에 실패했습니다." };

  revalidatePath("/dashboard/share");
  revalidatePath("/dashboard");
  return { ok: true, message: "수락했어요. 아래 '접근 중인 계정'에서 작업할 사업장을 열 수 있어요." };
}

/** 파트너가 초대 거절 또는 접근 해제 — partner_clients 링크 제거. */
export async function declineShareAction(id: string): Promise<ShareActionState> {
  const { user } = await sessionUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const email = (user.email ?? "").toLowerCase();

  const admin = createAdminClient();
  const { data: share } = await admin
    .from("account_shares")
    .select("id, owner_user_id, partner_email, partner_user_id")
    .eq("id", id)
    .maybeSingle();
  if (
    !share ||
    (share.partner_email.toLowerCase() !== email && share.partner_user_id !== user.id)
  )
    return { error: "초대를 찾을 수 없어요." };

  if (share.partner_user_id) {
    const { error: linkErr } = await admin
      .from("partner_clients")
      .delete()
      .eq("partner_user_id", share.partner_user_id)
      .eq("client_user_id", share.owner_user_id);
    if (linkErr) {
      console.error("[share] decline link delete failed", id, linkErr);
      return { error: "접근 권한 해제에 실패했어요. 잠시 후 다시 시도해주세요." };
    }
  }
  const { error: shareErr } = await admin.from("account_shares").delete().eq("id", id);
  if (shareErr) return { error: "처리에 실패했어요." };

  revalidatePath("/dashboard/share");
  revalidatePath("/dashboard");
  return { ok: true };
}
