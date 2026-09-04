import { createClient } from "@/lib/supabase/server";
import type { PaymentRow } from "@/types/database";

export interface PointTx {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
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

/** 내 결제 내역 (RLS: 본인만). */
export async function getMyPayments(userId: string): Promise<PaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
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
