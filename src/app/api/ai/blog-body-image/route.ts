import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reserveImageSlot, releaseImageSlot } from "@/lib/ai/imageSlot";
import { getLocale } from "@/lib/i18n";
import { generateAndStoreBlogBodyImage } from "@/lib/ai/blogBodyImage";

export const maxDuration = 60;

/** 초안 본문의 한 단락에 어울리는 이미지를 AI로 생성해 URL을 돌려준다. */
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
  let paragraph = "";
  let slotKey = "";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    postId = String(body.postId);
    paragraph = String(body.paragraph ?? "").trim();
    slotKey = String(body.slotKey ?? "");
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }

  // RLS로 소유 확인. 단락이 비어 있으면 제목·키워드로 대체한다.
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

  const subject =
    paragraph.slice(0, 2000) ||
    [post.title, ...(post.keywords ?? [])].filter(Boolean).join(", ");

  // 같은 슬롯 재생성 남용만 막는다(이미지는 무과금·딜리버리 포함). 글별로 슬롯을 구분.
  const bodySlot = `${postId}:${slotKey || "default"}`;
  if (!(await reserveImageSlot(supabase, businessId, bodySlot)))
    return NextResponse.json(
      {
        error: ko
          ? "이 이미지는 재생성 횟수 한도에 도달했습니다. 잠시 후 다시 시도해주세요."
          : "This image slot has reached its regeneration limit.",
      },
      { status: 429 },
    );

  const url = await generateAndStoreBlogBodyImage({
    businessId,
    category: business.category,
    paragraph: subject,
  });
  if (!url) {
    await releaseImageSlot(supabase, businessId, bodySlot);
    return NextResponse.json(
      {
        error: ko
          ? "이미지 생성에 실패했습니다. 다시 시도해주세요."
          : "Failed to generate the image. Please try again.",
      },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, url });
}
