"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";

export interface TeamActionState {
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

/** 계정 소유자가 직원을 이메일로 초대 (Pro 이상, 좌석 한도 내). */
export async function inviteMemberAction(
  rawEmail: string,
): Promise<TeamActionState> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 직원(다른 소유자의 멤버)은 팀 관리 불가
  const { data: ownerData } = await supabase.rpc("account_owner_id", {
    p_user: user.id,
  });
  if (typeof ownerData === "string" && ownerData && ownerData !== user.id)
    return { error: "직원 계정은 팀을 관리할 수 없어요." };

  const plan = getPlanById(await getPlanId(user.id));
  const seats = plan.maxMembers;
  if (seats !== null && seats <= 1)
    return {
      error: "직원 초대는 Pro 플랜에서 가능해요. 플랜을 업그레이드해주세요.",
    };

  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "올바른 이메일을 입력해주세요." };
  if (email === (user.email ?? "").toLowerCase())
    return { error: "본인은 초대할 수 없어요." };

  // 좌석 수 확인 (소유자 1 + 초대 인원). pending도 좌석을 차지한다.
  const { count } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", user.id);
  if (seats !== null && 1 + (count ?? 0) >= seats)
    return {
      error: `현재 플랜의 계정 한도(${seats}명)에 도달했어요.`,
    };

  const { error } = await supabase
    .from("team_members")
    .insert({ owner_user_id: user.id, invited_email: email, status: "pending" });
  if (error) {
    if (error.code === "23505")
      return { error: "이미 초대한 이메일이에요." };
    return { error: "초대에 실패했습니다." };
  }

  revalidatePath("/dashboard/team");
  return {
    ok: true,
    message: `${email} 님을 초대했어요. 상대가 같은 이메일로 로그인해 수락하면 연결됩니다.`,
  };
}

/** 소유자가 팀원(초대) 삭제. */
export async function removeMemberAction(
  id: string,
): Promise<TeamActionState> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "로그인이 필요합니다." };
  // RLS(owner_all)로 본인 팀 행만 삭제된다.
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) return { error: "삭제에 실패했습니다." };
  revalidatePath("/dashboard/team");
  return { ok: true };
}

/** 피초대자가 초대 수락 — member_user_id=본인, status=active. */
export async function acceptInviteAction(
  inviteId: string,
): Promise<TeamActionState> {
  const { user } = await sessionUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const email = (user.email ?? "").toLowerCase();
  if (!email) return { error: "이메일을 확인할 수 없어요." };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("team_members")
    .select("id, owner_user_id, invited_email, status")
    .eq("id", inviteId)
    .maybeSingle();
  if (!invite || invite.invited_email.toLowerCase() !== email)
    return { error: "초대를 찾을 수 없어요." };
  if (invite.owner_user_id === user.id)
    return { error: "본인 계정의 초대는 수락할 수 없어요." };

  // 한 사람은 한 소유자의 직원만 될 수 있다.
  const { data: existing } = await admin
    .from("team_members")
    .select("id")
    .eq("member_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (existing)
    return {
      error: "이미 다른 계정의 직원이에요. 기존 연결을 해제한 뒤 수락해주세요.",
    };

  // 좌석 한도 재확인 (소유자 플랜 기준)
  const plan = getPlanById(await getPlanId(invite.owner_user_id));
  if (plan.maxMembers !== null) {
    const { count } = await admin
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", invite.owner_user_id)
      .eq("status", "active");
    if (1 + (count ?? 0) >= plan.maxMembers)
      return { error: "소유자 계정의 좌석이 가득 찼어요." };
  }

  const { error } = await admin
    .from("team_members")
    .update({ member_user_id: user.id, status: "active" })
    .eq("id", inviteId);
  if (error) return { error: "수락에 실패했습니다." };

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard");
  return { ok: true, message: "수락했어요. 이제 해당 계정의 사업장을 관리할 수 있어요." };
}

/** 피초대자가 초대 거절(삭제) 또는 직원 연결 해제. */
export async function declineInviteAction(
  inviteId: string,
): Promise<TeamActionState> {
  const { user } = await sessionUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const email = (user.email ?? "").toLowerCase();

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("team_members")
    .select("id, invited_email, member_user_id")
    .eq("id", inviteId)
    .maybeSingle();
  // 내 이메일로 온 초대이거나 내가 연결된 멤버십만 해제 가능
  if (
    !invite ||
    (invite.invited_email.toLowerCase() !== email &&
      invite.member_user_id !== user.id)
  )
    return { error: "초대를 찾을 수 없어요." };

  const { error } = await admin.from("team_members").delete().eq("id", inviteId);
  if (error) return { error: "처리에 실패했습니다." };
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard");
  return { ok: true };
}
