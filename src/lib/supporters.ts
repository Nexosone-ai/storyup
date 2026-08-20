import { createClient } from "@/lib/supabase/server";

export interface SupporterCard {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  bio: string | null;
  skills: string[];
  portfolio_url: string | null;
  contact: string | null;
}

export type MySupporter = SupporterCard;

export interface ProjectRow {
  id: string;
  business_id: string;
  supporter_user_id: string;
  business_name: string;
  supporter_name: string;
  title: string;
  description: string | null;
  budget_points: number | null;
  status: string;
  created_at: string;
  asSupporter: boolean;
}

export async function getSupporterDirectory(): Promise<SupporterCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("supporter_profiles")
    .select("id,user_id,role,display_name,bio,skills,portfolio_url,contact")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getMySupporterProfile(
  userId: string,
): Promise<MySupporter | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("supporter_profiles")
    .select("id,user_id,role,display_name,bio,skills,portfolio_url,contact")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function getBusinessOptions(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("id,name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getMyProjects(userId: string): Promise<ProjectRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("collaboration_projects")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((p) => ({
    ...p,
    asSupporter: p.supporter_user_id === userId,
  }));
}
