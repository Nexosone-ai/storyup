import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import { getPlanId } from "@/lib/subscription";
import { getLocale } from "@/lib/i18n";

export const maxDuration = 30;

/**
 * 카드뉴스 스토리 가안 — 선택한 블로그 글로 기·승·전·결 한 줄 스토리를 만든다.
 * 카드 생성 전 스튜디오 '스토리' 칸에 미리 채워 사용자가 고치게 하는 용도라 제공량은 차감하지 않는다
 * (카드 생성 시 CARD_NEWS 로 차감). 카드뉴스와 같은 조건: 로그인 + 유료 플랜 + 본인(RLS) 사업장의 글.
 */
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
    businessId = String(body.businessId ?? "");
    blogPostId = String(body.blogPostId ?? "");
  } catch {
    /* 아래에서 처리 */
  }
  if (!businessId || !blogPostId)
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );

  if ((await getPlanId(user.id)) === "free")
    return NextResponse.json(
      { error: ko ? "카드뉴스는 유료 플랜 기능입니다." : "Card news needs a paid plan." },
      { status: 403 },
    );

  const [{ data: business }, { data: post }, { data: brand }] = await Promise.all([
    supabase.from("businesses").select("name,tone").eq("id", businessId).maybeSingle(),
    supabase
      .from("blog_posts")
      .select("title,summary,content")
      .eq("id", blogPostId)
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase.from("brand_profiles").select("tone").eq("business_id", businessId).maybeSingle(),
  ]);
  if (!business || !post)
    return NextResponse.json(
      { error: ko ? "블로그 글을 찾을 수 없습니다." : "Blog post not found." },
      { status: 404 },
    );

  try {
    const res = await getAIProvider().generateCardStory({
      businessName: business.name,
      brandTone: brand?.tone ?? business.tone ?? "Friendly",
      handle: "",
      articleTitle: post.title,
      articleSummary: post.summary ?? "",
      articleContent: post.content ?? "",
      language: locale,
    });
    const story = typeof res?.story === "string" ? res.story.trim().slice(0, 500) : "";
    if (!story) throw new AIGenerationError(ko ? "스토리 가안을 만들지 못했어요." : "Couldn't draft a story.");
    return NextResponse.json({ ok: true, story });
  } catch (err) {
    console.error("[ai/card-story]", err);
    const message =
      err instanceof AIGenerationError
        ? err.message
        : ko
          ? "스토리 가안을 만들지 못했어요. 직접 적거나 다시 시도해주세요."
          : "Couldn't draft a story. Write one or try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
