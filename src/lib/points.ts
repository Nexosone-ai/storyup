import { createClient } from "@/lib/supabase/server";

export interface PointTx {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  account_info: string;
  status: string;
  created_at: string;
}

export interface AdminWithdrawal extends Withdrawal {
  user_id: string;
  userName: string;
  userEmail: string;
}

export async function getBalance(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("point_transactions")
    .select("amount")
    .eq("user_id", userId);
  return (data ?? []).reduce((s, t) => s + t.amount, 0);
}

export async function getMyTransactions(userId: string): Promise<PointTx[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("point_transactions")
    .select("id,amount,reason,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getMyWithdrawals(userId: string): Promise<Withdrawal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("withdrawal_requests")
    .select("id,amount,account_info,status,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data?.is_admin;
}

/** Admin: all pending withdrawals with requester name/email. */
export async function getPendingWithdrawals(): Promise<AdminWithdrawal[]> {
  const supabase = await createClient();
  const { data: reqs } = await supabase
    .from("withdrawal_requests")
    .select("id,user_id,amount,account_info,status,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const list = reqs ?? [];
  if (list.length === 0) return [];

  const ids = [...new Set(list.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id,name,email")
    .in("user_id", ids);
  const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return list.map((r) => ({
    ...r,
    userName: byUser.get(r.user_id)?.name ?? "이름 없음",
    userEmail: byUser.get(r.user_id)?.email ?? "",
  }));
}
