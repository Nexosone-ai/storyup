"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SUPPORTER_ROLES, type SupporterRole } from "@/types/domain";

export interface SupporterState {
  error?: string;
  ok?: boolean;
}

const PATH = "/dashboard/supporters";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function saveSupporterProfile(fields: {
  role: string;
  displayName: string;
  bio: string;
  skills: string[];
  portfolioUrl: string;
  contact: string;
}): Promise<SupporterState> {
  if (!(SUPPORTER_ROLES as readonly string[]).includes(fields.role))
    return { error: "역할을 선택해주세요." };
  if (!fields.displayName.trim()) return { error: "이름을 입력해주세요." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase.from("supporter_profiles").upsert(
    {
      user_id: user.id,
      role: fields.role as SupporterRole,
      display_name: fields.displayName.trim(),
      bio: fields.bio.trim() || null,
      skills: fields.skills,
      portfolio_url: fields.portfolioUrl.trim() || null,
      contact: fields.contact.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: "저장에 실패했습니다." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function requestProject(fields: {
  businessId: string;
  supporterUserId: string;
  supporterName: string;
  title: string;
  description: string;
  budgetPoints: number | null;
}): Promise<SupporterState> {
  if (!fields.businessId) return { error: "의뢰할 비즈니스를 선택해주세요." };
  if (!fields.title.trim()) return { error: "프로젝트 제목을 입력해주세요." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (fields.supporterUserId === user.id)
    return { error: "본인에게는 의뢰할 수 없습니다." };

  const { data: biz } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", fields.businessId)
    .maybeSingle();
  if (!biz) return { error: "비즈니스를 찾을 수 없습니다." };

  const { error } = await supabase.from("collaboration_projects").insert({
    business_id: fields.businessId,
    supporter_user_id: fields.supporterUserId,
    business_name: biz.name,
    supporter_name: fields.supporterName,
    title: fields.title.trim(),
    description: fields.description.trim() || null,
    budget_points:
      fields.budgetPoints && fields.budgetPoints > 0
        ? Math.floor(fields.budgetPoints)
        : null,
  });
  if (error) return { error: "의뢰에 실패했습니다." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateProjectStatus(
  id: string,
  status: "accepted" | "declined" | "completed",
): Promise<SupporterState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase
    .from("collaboration_projects")
    .update({ status })
    .eq("id", id);
  if (error) return { error: "처리에 실패했습니다." };
  revalidatePath(PATH);
  return { ok: true };
}
