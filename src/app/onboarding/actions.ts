"use server";

import { createClient } from "@/lib/supabase/server";
import { slugWithFallback, randomSuffix } from "@/utils/slug";
import { BUSINESS_CATEGORIES, BRAND_TONES } from "@/types/domain";
import type { BusinessInterviewInput } from "@/types/domain";

export interface CreateBusinessResult {
  businessId?: string;
  error?: string;
}

export async function createBusinessAction(
  input: BusinessInterviewInput,
): Promise<CreateBusinessResult> {
  const name = input.name?.trim();
  if (!name) return { error: "사업 이름을 입력해주세요." };
  if (!BUSINESS_CATEGORIES.includes(input.category))
    return { error: "업종을 선택해주세요." };
  if (!input.founder_story?.trim())
    return { error: "사업을 시작한 이야기를 들려주세요." };
  if (!BRAND_TONES.includes(input.tone))
    return { error: "브랜드 톤을 선택해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // Ensure a unique slug.
  let slug = slugWithFallback(name);
  const { data: existing } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) slug = `${slug}-${randomSuffix()}`;

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      user_id: user.id,
      name,
      category: input.category,
      founder_story: input.founder_story.trim(),
      target_customer: input.target_customer?.trim() || null,
      strengths: input.strengths?.trim() || null,
      tone: input.tone,
      slug,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "비즈니스 생성에 실패했습니다." };
  return { businessId: data.id };
}
