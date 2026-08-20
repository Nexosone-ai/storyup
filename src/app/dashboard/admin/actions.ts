"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/points";

export interface AdminState {
  error?: string;
  ok?: boolean;
  message?: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, admin: !!data?.is_admin };
}

export async function grantPoints(
  email: string,
  amount: number,
  reason: string,
): Promise<AdminState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  if (!Number.isInteger(amount) || amount === 0)
    return { error: "지급/차감할 포인트를 입력해주세요." };

  const adminc = createAdminClient();
  const { data: profile } = await adminc
    .from("profiles")
    .select("user_id,name")
    .eq("email", email.trim())
    .maybeSingle();
  if (!profile) return { error: "해당 이메일의 사용자를 찾을 수 없습니다." };

  const { error } = await adminc.from("point_transactions").insert({
    user_id: profile.user_id,
    amount,
    reason: reason.trim() || "관리자 지급",
    ref_type: "admin_grant",
  });
  if (error) return { error: "지급에 실패했습니다." };
  revalidatePath("/dashboard/admin");
  return { ok: true, message: `${profile.name ?? email}님에게 ${amount}P 반영되었습니다.` };
}

export async function decideWithdrawal(
  id: string,
  approve: boolean,
): Promise<AdminState> {
  const { user, admin } = await requireAdmin();
  if (!admin || !user) return { error: "권한이 없습니다." };

  const adminc = createAdminClient();
  const { data: req } = await adminc
    .from("withdrawal_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!req || req.status !== "pending")
    return { error: "이미 처리되었거나 존재하지 않는 요청입니다." };

  if (approve) {
    const balance = await getBalance(req.user_id);
    if (req.amount > balance)
      return { error: "사용자의 보유 포인트가 부족합니다." };
    await adminc.from("point_transactions").insert({
      user_id: req.user_id,
      amount: -req.amount,
      reason: "포인트 출금",
      ref_type: "withdrawal",
      ref_id: id,
    });
  }

  await adminc
    .from("withdrawal_requests")
    .update({
      status: approve ? "approved" : "rejected",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/dashboard/admin");
  return { ok: true };
}
