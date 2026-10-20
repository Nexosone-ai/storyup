import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { blogInterviewSystem } from "@/lib/ai/prompts/blog";
import { getLocale } from "@/lib/i18n";

export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_TURNS = 30;

/**
 * 대화형 블로그 글감 — 인터뷰 한 턴. AI가 한 번에 하나씩 질문하고 근거를 밝힌다.
 * 대화(채팅)는 무료 — 실제 글 생성은 '글감 완성'(blog-from-conversation)에서 과금.
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
  try {
    const body = await request.json();
    businessId = String(body.businessId);
    if (Array.isArray(body.messages))
      messages = body.messages
        .slice(-MAX_TURNS)
        .map((m: { role?: string; content?: unknown }) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content ?? "").slice(0, 4000),
        }))
        .filter((m: { content: string }) => m.content.trim());
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }
  if (messages.length === 0)
    return NextResponse.json(
      { error: ko ? "내용을 입력해주세요." : "Please enter a message." },
      { status: 400 },
    );

  // RLS로 본인 사업장만 접근.
  const { data: business } = await supabase
    .from("businesses")
    .select("name, category, tone")
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

  const system = blogInterviewSystem({
    businessName: business.name,
    category: business.category,
    brandTone: brand?.tone ?? business.tone ?? "Friendly",
    language: locale,
  });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const reply = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({
      ok: true,
      reply: reply || (ko ? "조금 더 자세히 말씀해주시겠어요?" : "Could you tell me more?"),
    });
  } catch (err) {
    console.error("[ai/blog-interview]", err);
    return NextResponse.json(
      {
        error: ko
          ? "응답 생성 중 문제가 발생했어요. 다시 시도해주세요."
          : "Something went wrong. Please try again.",
      },
      { status: 502 },
    );
  }
}
