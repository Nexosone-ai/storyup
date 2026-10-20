import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusiness, getBrandProfile } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import {
  getOrCreateConversation,
  loadMessages,
  saveMessage,
} from "@/lib/ai/agent/store";
import { runAgentTurnStream } from "@/lib/ai/agent/runnerStream";
import { getFacebookStatus } from "@/lib/social/facebook";
import { getYoutubeStatus } from "@/lib/youtube";
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

  // 소유권/대행 접근 + 파트너 게이트. (대행 파트너 전용 기능)
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
          ? "AI 에이전트는 대행 파트너 전용 기능이에요."
          : "The AI agent is available to partners only.",
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

  // 대화(채팅)는 무료 — 비용이 드는 생성/작업은 승인 시 파트너 패킷(크레딧)으로 차감.
  // 여기부터는 SSE 스트림으로 응답(text/event-stream).
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const convId = await getOrCreateConversation(
          supabase,
          businessId,
          user.id,
          conversationId,
        );
        if (!convId) {
          send({
            type: "error",
            error: ko ? "대화를 찾을 수 없습니다." : "Conversation not found.",
          });
          controller.close();
          return;
        }

        const history = await loadMessages(supabase, convId);
        await saveMessage(supabase, {
          conversationId: convId,
          businessId,
          role: "user",
          content: message,
        });

        const [brand, fbStatus, ytStatus] = await Promise.all([
          getBrandProfile(businessId),
          getFacebookStatus(businessId),
          getYoutubeStatus(user.id),
        ]);
        const result = await runAgentTurnStream(
          {
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
              social: {
                facebook: {
                  configured: fbStatus.configured,
                  connected: fbStatus.connected,
                },
                youtube: {
                  configured: ytStatus.configured,
                  connected: ytStatus.connected,
                },
              },
            },
            ko,
          },
          (e) => send(e),
        );

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

        if (result.proposals.length > 0)
          send({ type: "proposals", proposals: result.proposals });
        send({ type: "done", conversationId: convId, text: result.text });
        controller.close();
      } catch (err) {
        console.error("[agent/chat]", err);
        send({
          type: "error",
          error: ko
            ? "응답 생성 중 문제가 발생했어요. 다시 시도해주세요."
            : "Something went wrong. Please try again.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
