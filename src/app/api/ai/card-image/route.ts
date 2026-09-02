import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider } from "@/lib/ai";
import { chargeAiUsage, InsufficientPointsError } from "@/lib/ai/billing";
import { getImageProvider, ImageGenerationError } from "@/lib/ai/image";
import type { ImageAspect } from "@/lib/ai/image";
import { buildCardImagePrompt } from "@/lib/ai/image/prompt";
import { getLocale } from "@/lib/i18n";

export const maxDuration = 60;

const ASPECTS: ImageAspect[] = ["1:1", "3:4", "4:3", "9:16", "16:9"];

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
  let aspect: ImageAspect = "3:4";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    subject = String(body.subject ?? "").slice(0, 300);
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
    .select("category")
    .eq("id", businessId)
    .maybeSingle();
  if (!business)
    return NextResponse.json(
      { error: ko ? "비즈니스를 찾을 수 없습니다." : "Business not found." },
      { status: 404 },
    );

  let billing;
  try {
    billing = await chargeAiUsage(user.id, "IMAGE_GENERATION", "AI 이미지 생성");
  } catch (err) {
    if (err instanceof InsufficientPointsError)
      return NextResponse.json({ error: err.message }, { status: 402 });
    throw err;
  }

  try {
    // 한글 카드 문구를 영문 피사체 묘사로 변환 (이미지 모델은 한글을 이해하지 못함)
    const scene = await getAIProvider()
      .generateImageSubject({ category: business.category, text: subject })
      .catch(() => subject);
    const prompt = buildCardImagePrompt(business.category, scene);
    const { b64, mime } = await getImageProvider().generateImage(prompt, aspect);
    return NextResponse.json({ ok: true, image: `data:${mime};base64,${b64}` });
  } catch (err) {
    await billing.refund();
    const message =
      err instanceof ImageGenerationError
        ? err.message
        : ko
          ? "이미지 생성 중 문제가 발생했습니다."
          : "Something went wrong while generating the image.";
    console.error("[ai/card-image]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
