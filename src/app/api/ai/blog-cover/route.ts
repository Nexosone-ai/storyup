import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { generateAndStoreBlogCover } from "@/lib/ai/blogCover";

export const maxDuration = 60;

/** 기존 블로그 글의 커버 이미지를 (재)생성한다. */
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
  let postId = "";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    postId = String(body.postId);
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
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, keywords")
    .eq("id", postId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!business || !post)
    return NextResponse.json(
      { error: ko ? "글을 찾을 수 없습니다." : "Post not found." },
      { status: 404 },
    );

  const url = await generateAndStoreBlogCover({
    businessId,
    category: business.category,
    title: post.title,
    keywords: post.keywords ?? [],
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

  const { error } = await supabase
    .from("blog_posts")
    .update({ cover_image_url: url })
    .eq("id", postId)
    .eq("business_id", businessId);
  if (error)
    return NextResponse.json(
      { error: ko ? "저장에 실패했습니다." : "Failed to save." },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, url });
}
