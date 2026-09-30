"use server";

import { createClient } from "@/lib/supabase/server";
import { slugWithFallback, randomSuffix } from "@/utils/slug";
import { BUSINESS_CATEGORIES, BRAND_TONES, INDUSTRY_IDS } from "@/types/domain";
import type { BusinessInterviewInput } from "@/types/domain";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";

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
  // 업종은 선택 사항 — 값이 있으면 유효성만 검사한다.
  if (input.industry && !INDUSTRY_IDS.includes(input.industry))
    return { error: "올바른 업종을 선택해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 플랜별 사업장 개수 제한 (Free 1 · Basic 1 · Pro 5 · Partner 협의=무제한).
  const plan = getPlanById(await getPlanId(user.id));
  if (plan.maxBusinesses !== null) {
    const { count } = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= plan.maxBusinesses) {
      return {
        error:
          plan.maxBusinesses === 1
            ? `현재 ${plan.name.ko} 플랜에서는 사업장을 1개만 만들 수 있어요. 더 추가하려면 상위 플랜으로 업그레이드해주세요.`
            : `현재 ${plan.name.ko} 플랜의 사업장 한도(${plan.maxBusinesses}개)에 도달했어요. 더 추가하려면 상위 플랜으로 업그레이드해주세요.`,
      };
    }
  }

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
      industry: input.industry || null,
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
