import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider } from "@/lib/ai";
import { reserveImageSlot, releaseImageSlot } from "@/lib/ai/imageSlot";
import { getImageProvider, ImageGenerationError } from "@/lib/ai/image";
import { buildLogoPrompt } from "@/lib/ai/image/prompt";
import { storeGeneratedImage } from "@/lib/ai/imageStore";
import { getLocale } from "@/lib/i18n";

export const maxDuration = 60;

/** 홈페이지 헤더용 AI 로고(심볼 마크) 생성 — 스토리지에 저장하고 URL을 반환한다. */
export async function POST(request: Request) {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: ko ? "로그인이 필요합니다." : "Please log in." },
      { status: 401 },
    );

  let businessId = "";
  let hint = "";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    hint = String(body.hint ?? "").slice(0, 200);
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }

  // RLS ensures ownership.
  const { data: business } = await supabase
    .from("businesses")
    .select("name, category")
    .eq("id", businessId)
    .maybeSingle();
  if (!business)
    return NextResponse.json(
      { error: ko ? "비즈니스를 찾을 수 없습니다." : "Business not found." },
      { status: 404 },
    );

  // 로고 재생성 남용 방지(이미지는 무과금). 슬롯 키는 'logo' 고정.
  const slotKey = "logo";
  if (!(await reserveImageSlot(supabase, user.id, businessId, slotKey)))
    return NextResponse.json(
      {
        error: ko
          ? "로고 재생성 횟수 한도에 도달했습니다. 직접 업로드하거나 잠시 후 다시 시도해주세요."
          : "Logo regeneration limit reached.",
      },
      { status: 429 },
    );

  try {
    // 상호/업종/힌트 → 영문 상징 묘사(이미지 모델은 한글을 이해하지 못함).
    const text = hint || business.name;
    const symbol = await getAIProvider()
      .generateImageSubject({ category: business.category, text, kind: "still-life" })
      .catch(() => text);
    const prompt = buildLogoPrompt(business.category, symbol);
    const image = await getImageProvider().generateImage(prompt, "1:1");

    const url = await storeGeneratedImage(businessId, "site-logo", image);
    if (!url) throw new Error("storage upload failed");

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    await releaseImageSlot(supabase, businessId, slotKey);
    const message =
      err instanceof ImageGenerationError
        ? err.message
        : ko
          ? "로고 생성 중 문제가 발생했습니다."
          : "Something went wrong while generating the logo.";
    console.error("[ai/site-logo]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
