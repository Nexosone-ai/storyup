import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider, AIGenerationError } from "@/lib/ai";
import { chargeAiUsage, InsufficientPointsError } from "@/lib/ai/billing";
import { createBlogDraft } from "@/lib/blogDraft";
import { getLocale } from "@/lib/i18n";
import { BLOG_TONES, BLOG_LENGTHS } from "@/types/domain";
import type { BlogTone, BlogLength } from "@/types/domain";

export const maxDuration = 60;

/**
 * 대화형 글감 → 블로그 초안. 주고받은 대화를 전사문처럼 넘겨 글로 재구성한다.
 * (음성 블로그와 동일한 생성 경로 재사용 — 말한/적은 내용만 사용, 창작 금지)
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
  let messages: { role: "user" | "assistant"; content: string }[] = [];
  let tone: BlogTone = "Friendly";
  let length: BlogLength = "Medium";
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    if (Array.isArray(body.messages))
      messages = body.messages.map((m: { role?: string; content?: unknown }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? "").slice(0, 4000),
      }));
    if (BLOG_TONES.includes(body.tone)) tone = body.tone;
    if (BLOG_LENGTHS.includes(body.length)) length = body.length;
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }

  // 대화를 전사문 형태로 정리(질문/답변 표시). AI가 근거로 밝힌 내용도 함께 들어간다.
  const transcript = messages
    .filter((m) => m.content.trim())
    .map((m) => `${m.role === "assistant" ? (ko ? "[질문/정리]" : "[Q]") : ko ? "[사장님 답변]" : "[A]"} ${m.content}`)
    .join("\n\n");
  if (transcript.length < 40)
    return NextResponse.json(
      {
        error: ko
          ? "대화 내용이 충분하지 않아요. 조금 더 이야기를 나눈 뒤 완성해주세요."
          : "Not enough conversation yet. Chat a bit more.",
      },
      { status: 400 },
    );

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  if (!business)
    return NextResponse.json(
      { error: ko ? "비즈니스를 찾을 수 없습니다." : "Business not found." },
      { status: 404 },
    );

  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("tone")
    .eq("business_id", businessId)
    .maybeSingle();

  let billing;
  try {
    billing = await chargeAiUsage(user.id, "AI_BLOG", "대화형 블로그 생성");
  } catch (err) {
    if (err instanceof InsufficientPointsError)
      return NextResponse.json({ error: err.message }, { status: 402 });
    throw err;
  }

  try {
    const article = await getAIProvider().generateBlogFromTranscript({
      businessName: business.name,
      category: business.category,
      brandTone: brand?.tone ?? business.tone ?? "Friendly",
      transcript,
      tone,
      length,
      language: locale,
    });
    const postId = await createBlogDraft({
      supabase,
      userId: user.id,
      businessId,
      category: business.category,
      article,
    });
    return NextResponse.json({ ok: true, postId });
  } catch (err) {
    await billing.refund();
    const message =
      err instanceof AIGenerationError
        ? err.message
        : ko
          ? "글 생성 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Something went wrong while writing the post. Please try again.";
    console.error("[ai/blog-from-conversation]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
