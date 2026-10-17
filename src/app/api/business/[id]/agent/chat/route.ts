import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusiness, getBrandProfile } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { chargeAiUsage, InsufficientPointsError } from "@/lib/ai/billing";
import {
  getOrCreateConversation,
  loadMessages,
  saveMessage,
} from "@/lib/ai/agent/store";
import { runAgentTurn } from "@/lib/ai/agent/runner";
import type { Json } from "@/types/database";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params;
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

  // 소유권 + Pro 게이트.
  const business = await getBusiness(businessId);
  if (!business)
    return NextResponse.json(
      { error: ko ? "권한이 없습니다." : "No permission." },
      { status: 403 },
    );
  const plan = getPlanById(await getPlanId(user.id));
  if (!plan.aiAgent)
    return NextResponse.json(
      {
        error: ko
          ? "AI 에이전트는 Pro 플랜에서 사용할 수 있어요."
          : "The AI agent is available on the Pro plan.",
      },
      { status: 403 },
    );

  let message = "";
  let conversationId: string | null = null;
  try {
    const body = await request.json();
    message = String(body.message ?? "").trim();
    conversationId = body.conversationId ? String(body.conversationId) : null;
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }
  if (!message)
    return NextResponse.json(
      { error: ko ? "메시지를 입력해주세요." : "Please enter a message." },
      { status: 400 },
    );

  // 메시지당 과금(관리자 단가 미설정 시 무료).
  let billing;
  try {
    billing = await chargeAiUsage(user.id, "AI_AGENT_CHAT", "AI 에이전트 대화");
  } catch (err) {
    if (err instanceof InsufficientPointsError)
      return NextResponse.json({ error: err.message }, { status: 402 });
    throw err;
  }

  try {
    const convId = await getOrCreateConversation(
      supabase,
      businessId,
      user.id,
      conversationId,
    );
    if (!convId) {
      await billing.refund();
      return NextResponse.json(
        { error: ko ? "대화를 찾을 수 없습니다." : "Conversation not found." },
        { status: 403 },
      );
    }

    const history = await loadMessages(supabase, convId);
    await saveMessage(supabase, {
      conversationId: convId,
      businessId,
      role: "user",
      content: message,
    });

    const brand = await getBrandProfile(businessId);
    const result = await runAgentTurn({
      supabase,
      userId: user.id,
      businessId,
      conversationId: convId,
      history,
      userMessage: message,
      agent: {
        name: business.name,
        category: business.category,
        brandStory: brand?.brand_story ?? null,
        tone: brand?.tone ?? business.tone ?? null,
      },
      ko,
    });

    await saveMessage(supabase, {
      conversationId: convId,
      businessId,
      role: "assistant",
      content: result.text,
      toolJson:
        result.proposals.length > 0
          ? ({ proposals: result.proposals } as unknown as Json)
          : null,
    });

    return NextResponse.json({
      ok: true,
      conversationId: convId,
      text: result.text,
      proposals: result.proposals,
    });
  } catch (err) {
    await billing.refund();
    console.error("[agent/chat]", err);
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
