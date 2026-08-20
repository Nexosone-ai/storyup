"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/points";
import { WEBSITE_TEMPLATES, PLATFORM_FEE_PERCENT } from "@/types/domain";

export interface TemplateState {
  error?: string;
  ok?: boolean;
}

const PATH = "/dashboard/templates";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createTemplate(fields: {
  title: string;
  description: string;
  templateKey: string;
  previewImage: string;
  pricePoints: number;
}): Promise<TemplateState> {
  if (!fields.title.trim()) return { error: "제목을 입력해주세요." };
  if (!(WEBSITE_TEMPLATES as readonly string[]).includes(fields.templateKey))
    return { error: "기본 레이아웃을 선택해주세요." };
  if (!Number.isInteger(fields.pricePoints) || fields.pricePoints < 0)
    return { error: "가격을 올바르게 입력해주세요." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("premium_templates").insert({
    creator_user_id: user.id,
    creator_name: profile?.name || "익명",
    title: fields.title.trim(),
    description: fields.description.trim() || null,
    template_key: fields.templateKey,
    preview_image: fields.previewImage.trim() || null,
    price_points: Math.floor(fields.pricePoints),
  });
  if (error) return { error: "등록에 실패했습니다." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function setTemplateActive(
  id: string,
  active: boolean,
): Promise<TemplateState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase
    .from("premium_templates")
    .update({ active })
    .eq("id", id)
    .eq("creator_user_id", user.id);
  if (error) return { error: "변경에 실패했습니다." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<TemplateState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase
    .from("premium_templates")
    .delete()
    .eq("id", id)
    .eq("creator_user_id", user.id);
  if (error) return { error: "삭제에 실패했습니다." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function buyTemplate(templateId: string): Promise<TemplateState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: t } = await supabase
    .from("premium_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  if (!t || !t.active) return { error: "판매 중이 아닌 템플릿입니다." };
  if (t.creator_user_id === user.id)
    return { error: "본인 템플릿은 구매할 수 없습니다." };

  const { data: existing } = await supabase
    .from("template_purchases")
    .select("id")
    .eq("template_id", templateId)
    .eq("buyer_user_id", user.id)
    .maybeSingle();
  if (existing) return { error: "이미 구매한 템플릿입니다." };

  const balance = await getBalance(user.id);
  if (t.price_points > balance) return { error: "포인트가 부족합니다." };

  const fee = Math.floor((t.price_points * PLATFORM_FEE_PERCENT) / 100);
  const earning = t.price_points - fee;
  const adminc = createAdminClient();

  const { error: txErr } = await adminc.from("point_transactions").insert([
    {
      user_id: user.id,
      amount: -t.price_points,
      reason: `템플릿 구매: ${t.title}`,
      ref_type: "template_purchase",
      ref_id: templateId,
    },
    {
      user_id: t.creator_user_id,
      amount: earning,
      reason: `템플릿 판매: ${t.title}`,
      ref_type: "template_sale",
      ref_id: templateId,
    },
  ]);
  if (txErr) return { error: "결제 처리에 실패했습니다." };

  const { error } = await adminc.from("template_purchases").insert({
    template_id: templateId,
    buyer_user_id: user.id,
    creator_user_id: t.creator_user_id,
    price_points: t.price_points,
    creator_earning: earning,
    platform_fee: fee,
  });
  if (error) return { error: "구매 기록에 실패했습니다." };

  revalidatePath(PATH);
  revalidatePath("/dashboard/points");
  return { ok: true };
}
