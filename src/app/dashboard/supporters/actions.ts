"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
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
  const ko = (await getLocale()) === "ko";
  if (!(SUPPORTER_ROLES as readonly string[]).includes(fields.role))
    return { error: ko ? "역할을 선택해주세요." : "Please select a role." };
  if (!fields.displayName.trim())
    return { error: ko ? "이름을 입력해주세요." : "Please enter your name." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

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
  if (error) return { error: ko ? "저장에 실패했습니다." : "Failed to save." };
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
  const ko = (await getLocale()) === "ko";
  if (!fields.businessId)
    return {
      error: ko
        ? "의뢰할 비즈니스를 선택해주세요."
        : "Please select a business for this request.",
    };
  if (!fields.title.trim())
    return {
      error: ko ? "프로젝트 제목을 입력해주세요." : "Please enter a project title.",
    };

  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  if (fields.supporterUserId === user.id)
    return {
      error: ko
        ? "본인에게는 의뢰할 수 없습니다."
        : "You can't send a request to yourself.",
    };

  const { data: biz } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", fields.businessId)
    .maybeSingle();
  if (!biz)
    return { error: ko ? "비즈니스를 찾을 수 없습니다." : "Business not found." };

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
  if (error)
    return { error: ko ? "의뢰에 실패했습니다." : "Failed to send the request." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateProjectStatus(
  id: string,
  status: "accepted" | "declined" | "completed",
): Promise<SupporterState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  const { error } = await supabase
    .from("collaboration_projects")
    .update({ status })
    .eq("id", id);
  if (error)
    return { error: ko ? "처리에 실패했습니다." : "Something went wrong." };
  revalidatePath(PATH);
  return { ok: true };
}
