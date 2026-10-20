import Anthropic from "@anthropic-ai/sdk";
import type { DB, ChatMessage } from "./store";
import { AGENT_TOOLS, runTool, type ToolCtx, type ProposalOut } from "./tools";
import { searchMemories } from "./memory";

/**
 * AI 에이전트 1턴 실행 — 시스템 프롬프트(브랜드+기억) + 대화 히스토리로 Claude를
 * 호출하고, tool_use가 나오면 서버에서 도구를 실행/제안한 뒤 결과를 돌려주며
 * 최종 답변까지 루프를 돈다(최대 MAX_STEPS). 비스트리밍.
 */

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
export const MAX_STEPS = 5;

export interface AgentContext {
  name: string;
  category: string;
  brandStory?: string | null;
  tone?: string | null;
  /** 실시간 SNS 연동 상태 — 답변을 실제 UI에 맞게 안내하기 위함. */
  social?: {
    facebook: { configured: boolean; connected: boolean };
    youtube: { configured: boolean; connected: boolean };
  };
}

/** 실제 UI(이 페이지의 'SNS 연동' 카드)에 맞춘 연동 안내문 — 가짜 메뉴 경로를 지어내지 않도록. */
function socialGuide(social: AgentContext["social"]): string {
  if (!social) return "";
  const fbLine = !social.facebook.configured
    ? "Facebook: 현재 '설정 필요(관리자)' 상태 — STORYUP 관리자가 Meta 앱을 설정해야 연결 버튼이 나타납니다. 사장님이 직접 연결할 수 없으니 관리자에게 설정을 요청하라고 안내하세요."
    : social.facebook.connected
      ? "Facebook: 이미 연결됨 — 바로 게시를 제안할 수 있어요."
      : "Facebook: 아직 '연결 안 됨' — 'SNS 연동' 카드의 [페이지 연결] 버튼을 눌러 Facebook 로그인 후 게시할 페이지를 선택하면 연결됩니다.";
  const ytLine = !social.youtube.configured
    ? "YouTube: '설정 필요(관리자)' 상태 — 관리자 설정이 필요합니다."
    : social.youtube.connected
      ? "YouTube: 연결됨."
      : "YouTube: 아직 연결 안 됨 — 'SNS 연동' 카드의 [채널 연결] 버튼으로 연결합니다.";
  return `

[SNS 연동 안내 — 반드시 아래 사실대로만 안내하세요]
- SNS 연동 UI는 지금 이 'AI 에이전트' 페이지의 채팅 아래 '**SNS 연동**' 카드에 있습니다. '설정' 메뉴나 '연동 관리' 같은 별도 메뉴는 없으니 그런 경로를 지어내지 마세요.
- ${fbLine}
- ${ytLine}
- 연동 여부는 추측하지 말고 위 상태를 그대로 전달하세요.`;
}

export interface AgentTurnResult {
  text: string;
  proposals: ProposalOut[];
}

export function buildSystem(ctx: AgentContext, memories: string[]): string {
  const mem = memories.length
    ? `\n\n[기억한 사실]\n- ${memories.join("\n- ")}`
    : "";
  return `당신은 '${ctx.name}' 사업을 전담하는 STORYUP의 비즈니스 AI 에이전트입니다.
업종: ${ctx.category}. 브랜드 톤: ${ctx.tone ?? "Friendly"}.
${ctx.brandStory ? `브랜드 스토리: ${ctx.brandStory}` : ""}

역할: 사장님의 마케팅 파트너로서 블로그·카드뉴스·발행·SNS 게시를 돕습니다.
- 비용이 들거나 외부에 영향을 주는 작업(블로그 초안 생성, 카드뉴스 생성, 예약 발행, Facebook 페이지 게시)은 반드시 해당 '제안' 도구를 호출하세요. 직접 실행하지 말고, 승인은 사용자가 버튼으로 합니다.
- Facebook 게시는 페이지가 연결돼 있을 때만 제안하세요(publish_facebook가 연결 여부를 확인합니다).
- 대상 글의 ID가 필요하면 list_content로 먼저 확인하세요.
- 사용자가 중요한 사실(사업 정보·고객·마케팅 목표)을 알려주면 save_memory로 기억하세요.
- 한국어로 간결하고 친근하게 답하고, 제안을 만들면 무엇을 승인하면 되는지 한 줄로 안내하세요.${socialGuide(ctx.social)}${mem}`;
}

export async function runAgentTurn(args: {
  supabase: DB;
  userId: string;
  businessId: string;
  conversationId: string;
  history: ChatMessage[];
  userMessage: string;
  agent: AgentContext;
  ko: boolean;
}): Promise<AgentTurnResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const memories = await searchMemories(
    args.supabase,
    args.businessId,
    args.userMessage,
  );
  const system = buildSystem(args.agent, memories);
  const toolCtx: ToolCtx = {
    supabase: args.supabase,
    userId: args.userId,
    businessId: args.businessId,
    conversationId: args.conversationId,
    ko: args.ko,
  };

  const messages: Anthropic.MessageParam[] = [
    ...args.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: args.userMessage },
  ];

  const proposals: ProposalOut[] = [];
  let finalText = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      tools: AGENT_TOOLS,
      messages,
    });

    const textParts = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text);
    if (textParts.length) finalText = textParts.join("\n").trim();

    const toolUses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (res.stop_reason !== "tool_use" || toolUses.length === 0) break;

    messages.push({ role: "assistant", content: res.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const outcome = await runTool(
        tu.name,
        (tu.input ?? {}) as Record<string, unknown>,
        toolCtx,
      );
      if (outcome.proposal) proposals.push(outcome.proposal);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: outcome.result,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  if (!finalText)
    finalText = args.ko ? "무엇을 도와드릴까요?" : "How can I help?";
  return { text: finalText, proposals };
}
