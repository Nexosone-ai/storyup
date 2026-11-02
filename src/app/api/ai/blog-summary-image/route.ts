import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { generateAndStoreBlogSummaryImage } from "@/lib/ai/blogSummaryImage";
import { coerceImageStyle } from "@/lib/ai/image/style";

export const maxDuration = 60;

/**
 * 글 요약 이미지(1장) 생성 — Pro 전용.
 * 본문 내용을 요약한 장면으로 한 장 만들어 돌려준다(커버는 건드리지 않음).
 */
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

  // Pro 전용 기능.
  if ((await getPlanId(user.id)) !== "pro")
    return NextResponse.json(
      {
        error: ko
          ? "요약 이미지는 Pro 플랜 전용이에요."
          : "Summary images are a Pro-only feature.",
      },
      { status: 402 },
    );

  let businessId = "";
  let postId = "";
  let style: ReturnType<typeof coerceImageStyle> = "photo";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    postId = String(body.postId);
    style = coerceImageStyle(body.style);
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }

  // RLS로 소유권 확인.
  const { data: business } = await supabase
    .from("businesses")
    .select("category")
    .eq("id", businessId)
    .maybeSingle();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, summary, content")
    .eq("id", postId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!business || !post)
    return NextResponse.json(
      { error: ko ? "글을 찾을 수 없습니다." : "Post not found." },
      { status: 404 },
    );

  const url = await generateAndStoreBlogSummaryImage({
    businessId,
    category: business.category,
    title: post.title,
    summary: post.summary ?? "",
    content: post.content ?? "",
    style,
    language: ko ? "ko" : "en",
  });
  if (!url)
    return NextResponse.json(
      {
        error: ko
          ? "이미지 생성에 실패했습니다. 다시 시도해주세요."
          : "Failed to generate the image. Please try again.",
      },
      { status: 502 },
    );

  return NextResponse.json({ ok: true, url });
}
