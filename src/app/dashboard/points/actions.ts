"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/points";

export interface PointState {
  error?: string;
  ok?: boolean;
}

export async function requestWithdrawal(
  amount: number,
  accountInfo: string,
): Promise<PointState> {
  if (!Number.isInteger(amount) || amount <= 0)
    return { error: "출금할 포인트를 올바르게 입력해주세요." };
  if (!accountInfo.trim()) return { error: "정산 계좌 정보를 입력해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const balance = await getBalance(user.id);
  if (amount > balance)
    return { error: "보유 포인트보다 많이 출금할 수 없습니다." };

  const { error } = await supabase.from("withdrawal_requests").insert({
    user_id: user.id,
    amount,
    account_info: accountInfo.trim(),
  });
  if (error) return { error: "요청에 실패했습니다." };
  revalidatePath("/dashboard/points");
  return { ok: true };
}
