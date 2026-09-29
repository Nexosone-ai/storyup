import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider } from "@/lib/ai";
import { reserveImageSlot, releaseImageSlot } from "@/lib/ai/imageSlot";
import { getImageProvider, ImageGenerationError } from "@/lib/ai/image";
import type { ImageAspect } from "@/lib/ai/image";
import { buildSitePhotoPrompt } from "@/lib/ai/image/prompt";
import { storeGeneratedImage } from "@/lib/ai/imageStore";
import { getLocale } from "@/lib/i18n";

export const maxDuration = 60;

const ASPECTS: ImageAspect[] = ["1:1", "3:4", "4:3", "9:16", "16:9"];

/** 랜딩페이지 에디터용 AI 이미지 생성 — 스토리지에 저장하고 URL을 반환한다. */
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
  let subject = "";
  let slotKey = "";
  let aspect: ImageAspect = "16:9";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    subject = String(body.subject ?? "").slice(0, 300);
    slotKey = String(body.slotKey ?? "");
    if (ASPECTS.includes(body.aspect)) aspect = body.aspect;
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

  // 같은 슬롯 재생성 남용만 막는다(이미지는 무과금·딜리버리 포함).
  if (!(await reserveImageSlot(supabase, businessId, slotKey)))
    return NextResponse.json(
      {
        error: ko
          ? "이 이미지는 재생성 횟수 한도에 도달했습니다. 직접 업로드하거나 다른 이미지를 수정해주세요."
          : "This image slot has reached its regeneration limit.",
      },
      { status: 429 },
    );

  try {
    // 한글 문구를 영문 피사체 묘사로 변환 (이미지 모델은 한글을 이해하지 못함)
    const text = subject || business.name;
    const scene = await getAIProvider()
      .generateImageSubject({ category: business.category, text, kind: "scene" })
      .catch(() => text);
    const prompt = buildSitePhotoPrompt(business.category, scene);
    const image = await getImageProvider().generateImage(prompt, aspect);

    const url = await storeGeneratedImage(businessId, "site-ai", image);
    if (!url) throw new Error("storage upload failed");

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    await releaseImageSlot(supabase, businessId, slotKey);
    const message =
      err instanceof ImageGenerationError
        ? err.message
        : ko
          ? "이미지 생성 중 문제가 발생했습니다."
          : "Something went wrong while generating the image.";
    console.error("[ai/site-image]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
