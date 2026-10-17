import Anthropic from "@anthropic-ai/sdk";
import type { DB, ChatMessage } from "./store";
import { AGENT_TOOLS, runTool, type ToolCtx, type ProposalOut } from "./tools";
import { searchMemories } from "./memory";
import {
  buildSystem,
  MODEL,
  MAX_STEPS,
  type AgentContext,
  type AgentTurnResult,
} from "./runner";

/**
 * runAgentTurn의 스트리밍 변형 — 텍스트 델타를 onEvent로 흘리면서 동일한
 * 도구 루프(MAX_STEPS)를 돈다. 라우트가 SSE로 중계한다. 저장/과금은 라우트에서.
 */

export type AgentStreamEvent = { type: "delta"; text: string };

export async function runAgentTurnStream(
  args: {
    supabase: DB;
    userId: string;
    businessId: string;
    conversationId: string;
    history: ChatMessage[];
    userMessage: string;
    agent: AgentContext;
    ko: boolean;
  },
  onEvent: (e: AgentStreamEvent) => void,
): Promise<AgentTurnResult> {
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
  const stepTexts: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1500,
      system,
      tools: AGENT_TOOLS,
      messages,
    });

    let stepText = "";
    stream.on("text", (t) => {
      stepText += t;
      onEvent({ type: "delta", text: t });
    });

    const res = await stream.finalMessage();
    if (stepText.trim()) stepTexts.push(stepText.trim());

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

  const text =
    stepTexts.join("\n\n").trim() ||
    (args.ko ? "무엇을 도와드릴까요?" : "How can I help?");
  return { text, proposals };
}
