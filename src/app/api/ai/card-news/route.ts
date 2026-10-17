import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AIGenerationError } from "@/lib/ai";
import { InsufficientPointsError } from "@/lib/ai/billing";
import { generateAndSaveCardNews } from "@/lib/ai/generateCardNews";
import { getLocale } from "@/lib/i18n";

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

  let businessId = "";
  let blogPostId = "";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    blogPostId = String(body.blogPostId);
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const { cardNews, cardNewsId } = await generateAndSaveCardNews({
      supabase,
      userId: user.id,
      businessId,
      blogPostId,
      locale,
    });
    return NextResponse.json({ ok: true, cardNews, cardNewsId });
  } catch (err) {
    if (err instanceof InsufficientPointsError)
      return NextResponse.json({ error: err.message }, { status: 402 });
    if (err instanceof Error && err.message === "business not found")
      return NextResponse.json(
        { error: ko ? "비즈니스를 찾을 수 없습니다." : "Business not found." },
        { status: 404 },
      );
    if (err instanceof Error && err.message === "blog post not found")
      return NextResponse.json(
        { error: ko ? "블로그 글을 찾을 수 없습니다." : "Blog post not found." },
        { status: 404 },
      );
    const message =
      err instanceof AIGenerationError
        ? err.message
        : ko
          ? "카드뉴스 생성 중 문제가 발생했습니다."
          : "Something went wrong while generating the card news.";
    console.error("[ai/card-news]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
