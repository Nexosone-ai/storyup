import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import { generateAndStoreBlogCover } from "@/lib/ai/blogCover";
import { slugWithFallback, randomSuffix } from "@/utils/slug";
import { BLOG_TONES, BLOG_LENGTHS } from "@/types/domain";
import type { BlogTone, BlogLength } from "@/types/domain";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

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
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!topic)
    return NextResponse.json(
      { error: "어떤 내용을 쓰고 싶은지 알려주세요." },
      { status: 400 },
    );

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  if (!business)
    return NextResponse.json(
      { error: "비즈니스를 찾을 수 없습니다." },
      { status: 404 },
    );

  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("tone")
    .eq("business_id", businessId)
    .maybeSingle();

  try {
    const article = await getAIProvider().generateBlog({
      businessName: business.name,
      category: business.category,
      brandTone: brand?.tone ?? business.tone ?? "Friendly",
      topic,
      tone,
      length,
    });

    // Unique slug within this business.
    let slug = slugWithFallback(article.title, "post");
    const { data: dup } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("business_id", businessId)
      .eq("slug", slug)
      .maybeSingle();
    if (dup) slug = `${slug}-${randomSuffix()}`;

    const { data: inserted, error } = await supabase
      .from("blog_posts")
      .insert({
        business_id: businessId,
        title: article.title,
        slug,
        summary: article.summary,
        content: article.content,
        keywords: article.keywords ?? [],
        seo_title: article.seo_title,
        seo_description: article.seo_description,
        social_caption: article.social_caption,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !inserted) throw error ?? new Error("insert failed");

    // 커버 이미지는 실패하거나 늦어도 글 생성을 막지 않는다 (플레이스홀더로 대체).
    const cover = await generateAndStoreBlogCover({
      businessId,
      category: business.category,
      title: article.title,
      keywords: article.keywords ?? [],
      timeoutMs: 25_000,
    });
    if (cover) {
      await supabase
        .from("blog_posts")
        .update({ cover_image_url: cover })
        .eq("id", inserted.id);
    }

    return NextResponse.json({ ok: true, postId: inserted.id });
  } catch (err) {
    const message =
      err instanceof AIGenerationError
        ? err.message
        : "글 생성 중 문제가 발생했습니다. 다시 시도해주세요.";
    console.error("[ai/blog]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
