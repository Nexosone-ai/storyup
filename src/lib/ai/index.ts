import type { AIProvider } from "./provider";
import { ClaudeProvider } from "./claude";

export { AIGenerationError } from "./provider";
export type { AIProvider } from "./provider";

let cached: AIProvider | null = null;

/**
 * Returns the active AI provider. Server-only — never import from a
 * Client Component (it reads ANTHROPIC_API_KEY).
 */
export function getAIProvider(): AIProvider {
  if (!cached) cached = new ClaudeProvider();
  return cached;
}
