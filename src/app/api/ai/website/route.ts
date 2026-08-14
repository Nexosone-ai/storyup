import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import type {
  BusinessInterviewInput,
  BrandStoryResult,
  BrandTone,
} from "@/types/domain";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let businessId: string;
  try {
    businessId = String((await request.json()).businessId);
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  if (!business)
    return NextResponse.json(
      { error: "비즈니스를 찾을 수 없습니다." },
      { status: 404 },
    );

  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!brand)
    return NextResponse.json(
      { error: "브랜드를 먼저 만들어주세요." },
      { status: 400 },
    );

  const input: BusinessInterviewInput = {
    name: business.name,
    category: business.category as BusinessInterviewInput["category"],
    founder_story: business.founder_story ?? "",
    target_customer: business.target_customer ?? "",
    strengths: business.strengths ?? "",
    tone: (business.tone as BrandTone) ?? "Friendly",
  };

  const brandResult: BrandStoryResult = {
    brand_name: brand.brand_name ?? business.name,
    headline: brand.headline ?? "",
    slogan: brand.slogan ?? "",
    short_description: brand.short_description ?? "",
    brand_story: brand.brand_story ?? "",
    mission: brand.mission ?? "",
    target_customer: brand.target_customer ?? "",
    key_strengths: brand.key_strengths ?? [],
    brand_keywords: brand.brand_keywords ?? [],
    tone: brand.tone ?? "Friendly",
  };

  try {
    const content = await getAIProvider().generateWebsite(input, brandResult);

    const { error } = await supabase.from("websites").upsert(
      {
        business_id: businessId,
        slug: business.slug,
        content,
        status: "draft",
      },
      { onConflict: "business_id" },
    );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof AIGenerationError
        ? err.message
        : "홈페이지 생성 중 문제가 발생했습니다. 다시 시도해주세요.";
    console.error("[ai/website]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
