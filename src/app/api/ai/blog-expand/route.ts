import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import { chargeAiUsage, InsufficientPointsError } from "@/lib/ai/billing";
import { getLocale } from "@/lib/i18n";

export const maxDuration = 60;

/** 초안 본문의 한 단락을 AI로 이어서 더 작성한다 (에디터 단락 보강). */
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
  let postId = "";
  let paragraph = "";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    postId = String(body.postId);
    paragraph = String(body.paragraph ?? "").trim();
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }
  if (!paragraph)
    return NextResponse.json(
      {
        error: ko
          ? "이어쓸 단락을 선택해주세요."
          : "Place the cursor in a paragraph first.",
      },
      { status: 400 },
    );
  paragraph = paragraph.slice(0, 2000);

  // RLS로 소유 확인 + 맥락 로드
  const { data: business } = await supabase
    .from("businesses")
    .select("name, category")
    .eq("id", businessId)
    .maybeSingle();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, content")
    .eq("id", postId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!business || !post)
    return NextResponse.json(
      { error: ko ? "글을 찾을 수 없습니다." : "Post not found." },
      { status: 404 },
    );

  let billing;
  try {
    billing = await chargeAiUsage(user.id, "AI_BLOG_EXPAND", "AI 단락 이어쓰기");
  } catch (err) {
    if (err instanceof InsufficientPointsError)
      return NextResponse.json({ error: err.message }, { status: 402 });
    throw err;
  }

  try {
    const { text } = await getAIProvider().expandBlogParagraph({
      businessName: business.name,
      category: business.category,
      title: post.title,
      paragraph,
      fullContext: post.content ?? undefined,
      language: locale,
    });
    if (!text) {
      await billing.refund();
      return NextResponse.json(
        {
          error: ko
            ? "이어쓸 내용을 만들지 못했습니다. 다시 시도해주세요."
            : "Couldn't generate more text. Please try again.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, text });
  } catch (err) {
    await billing.refund();
    const message =
      err instanceof AIGenerationError
        ? err.message
        : ko
          ? "이어쓰기 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong. Please try again.";
    console.error("[ai/blog-expand]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
