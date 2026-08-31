import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import { chargeAiUsage, InsufficientPointsError } from "@/lib/ai/billing";
import { slugify } from "@/utils/slug";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let businessId = "";
  let blogPostId = "";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    blogPostId = String(body.blogPostId);
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("name,tone,slug")
    .eq("id", businessId)
    .maybeSingle();
  if (!business)
    return NextResponse.json(
      { error: "비즈니스를 찾을 수 없습니다." },
      { status: 404 },
    );

  const { data: post } = await supabase
    .from("blog_posts")
    .select("title,summary,content")
    .eq("id", blogPostId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!post)
    return NextResponse.json(
      { error: "블로그 글을 찾을 수 없습니다." },
      { status: 404 },
    );

  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("tone")
    .eq("business_id", businessId)
    .maybeSingle();

  let billing;
  try {
    billing = await chargeAiUsage(user.id, "CARD_NEWS", "카드뉴스 생성");
  } catch (err) {
    if (err instanceof InsufficientPointsError)
      return NextResponse.json({ error: err.message }, { status: 402 });
    throw err;
  }

  try {
    const result = await getAIProvider().generateCardNews({
      businessName: business.name,
      brandTone: brand?.tone ?? business.tone ?? "Friendly",
      handle: `@${slugify(business.slug) || "storyup"}`,
      articleTitle: post.title,
      articleSummary: post.summary ?? "",
      articleContent: post.content ?? "",
    });

    // Persist as a marketing_contents row (JSON in content).
    await supabase
      .from("marketing_contents")
      .delete()
      .eq("business_id", businessId)
      .eq("blog_post_id", blogPostId)
      .eq("platform", "instagram_cards");

    await supabase.from("marketing_contents").insert({
      business_id: businessId,
      blog_post_id: blogPostId,
      platform: "instagram_cards",
      content: JSON.stringify(result),
    });

    return NextResponse.json({ ok: true, cardNews: result });
  } catch (err) {
    await billing.refund();
    const message =
      err instanceof AIGenerationError
        ? err.message
        : "카드뉴스 생성 중 문제가 발생했습니다.";
    console.error("[ai/card-news]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
