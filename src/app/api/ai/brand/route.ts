import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import { chargeAiUsage, InsufficientPointsError } from "@/lib/ai/billing";
import { trackGrowthActivity } from "@/lib/gamification/engine";
import { getLocale } from "@/lib/i18n";
import type { BusinessInterviewInput, BrandTone } from "@/types/domain";

export const maxDuration = 60;

export async function POST(request: Request) {
  const locale = await getLocale();
  const ko = locale === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: ko ? "로그인이 필요합니다." : "Please log in." },
      { status: 401 },
    );

  let businessId: string;
  try {
    const body = await request.json();
    businessId = String(body.businessId);
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }

  // RLS ensures only the owner can read this business.
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  if (!business)
    return NextResponse.json(
      { error: ko ? "비즈니스를 찾을 수 없습니다." : "Business not found." },
      { status: 404 },
    );

  const input: BusinessInterviewInput = {
    name: business.name,
    category: business.category as BusinessInterviewInput["category"],
    founder_story: business.founder_story ?? "",
    target_customer: business.target_customer ?? "",
    strengths: business.strengths ?? "",
    tone: (business.tone as BrandTone) ?? "Friendly",
  };

  let billing;
  try {
    billing = await chargeAiUsage(user.id, "AI_BRAND", "AI 브랜드 스토리 생성");
  } catch (err) {
    if (err instanceof InsufficientPointsError)
      return NextResponse.json({ error: err.message }, { status: 402 });
    throw err;
  }

  try {
    const brand = await getAIProvider().generateBrandStory(input, locale);

    const { error } = await supabase.from("brand_profiles").upsert(
      {
        business_id: businessId,
        brand_name: brand.brand_name,
        headline: brand.headline,
        slogan: brand.slogan,
        short_description: brand.short_description,
        brand_story: brand.brand_story,
        mission: brand.mission,
        target_customer: brand.target_customer,
        key_strengths: brand.key_strengths ?? [],
        brand_keywords: brand.brand_keywords ?? [],
        tone: brand.tone,
      },
      { onConflict: "business_id" },
    );
    if (error) throw error;

    // 성장 보상 — 브랜드 프로필 완성 (비즈니스당 1회, 실패해도 무시)
    await trackGrowthActivity(user.id, "brand_profile", businessId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    await billing.refund();
    const message =
      err instanceof AIGenerationError
        ? err.message
        : ko
          ? "브랜드 생성 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong while building your brand. Please try again.";
    console.error("[ai/brand]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
