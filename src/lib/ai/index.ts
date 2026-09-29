import type { AIProvider } from "./provider";
import { ClaudeProvider } from "./claude";
import { OpenAIProvider } from "./openai";

export { AIGenerationError } from "./provider";
export type { AIProvider } from "./provider";

let cached: AIProvider | null = null;

/**
 * Returns the active AI provider. Server-only — never import from a
 * Client Component (it reads ANTHROPIC_API_KEY / OPENAI_API_KEY).
 *
 * AI_PROVIDER 환경변수로 프로바이더를 고른다:
 *   - "openai" | "chatgpt" → OpenAI(ChatGPT)
 *   - 그 외/미설정         → Claude (기본)
 */
export function getAIProvider(): AIProvider {
  if (!cached) {
    const which = (process.env.AI_PROVIDER || "").trim().toLowerCase();
    cached =
      which === "openai" || which === "chatgpt"
        ? new OpenAIProvider()
        : new ClaudeProvider();
  }
  return cached;
}
