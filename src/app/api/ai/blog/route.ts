import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AIGenerationError } from "@/lib/ai";
import { InsufficientPointsError } from "@/lib/ai/billing";
import { FreeBlogLimitError } from "@/lib/freeAccess";
import { generateAndSaveBlog } from "@/lib/ai/generateBlog";
import { getLocale } from "@/lib/i18n";
import { BLOG_TONES, BLOG_LENGTHS } from "@/types/domain";
import type { BlogTone, BlogLength } from "@/types/domain";

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
  let topic = "";
  let tone: BlogTone = "Friendly";
  let length: BlogLength = "Medium";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    topic = String(body.topic ?? "").trim();
    if (BLOG_TONES.includes(body.tone)) tone = body.tone;
    if (BLOG_LENGTHS.includes(body.length)) length = body.length;
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }
  if (!topic)
    return NextResponse.json(
      {
        error: ko
          ? "어떤 내용을 쓰고 싶은지 알려주세요."
          : "Please tell us what you'd like to write about.",
      },
      { status: 400 },
    );

  try {
    const { postId } = await generateAndSaveBlog({
      supabase,
      userId: user.id,
      businessId,
      topic,
      tone,
      length,
      locale,
    });
    return NextResponse.json({ ok: true, postId });
  } catch (err) {
    if (err instanceof FreeBlogLimitError)
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 402 },
      );
    if (err instanceof InsufficientPointsError)
      return NextResponse.json({ error: err.message }, { status: 402 });
    if (err instanceof Error && err.message === "business not found")
      return NextResponse.json(
        { error: ko ? "비즈니스를 찾을 수 없습니다." : "Business not found." },
        { status: 404 },
      );
    const message =
      err instanceof AIGenerationError
        ? err.message
        : ko
          ? "글 생성 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong while writing the post. Please try again.";
    console.error("[ai/blog]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
