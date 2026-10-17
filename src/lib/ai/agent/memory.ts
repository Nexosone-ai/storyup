import type { DB } from "./store";

/**
 * 에이전트 장기 기억 — 사용자가 알려준 사실을 사업체 단위로 보관하고, 매 턴
 * 비폐기(superseded=false) 기억을 시스템 프롬프트에 주입한다. (시맨틱 검색은 2차)
 */

export async function loadMemories(
  supabase: DB,
  businessId: string,
  limit = 20,
): Promise<string[]> {
  const { data } = await supabase
    .from("agent_memories")
    .select("content")
    .eq("business_id", businessId)
    .eq("superseded", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => r.content);
}

export async function saveMemory(
  supabase: DB,
  businessId: string,
  content: string,
  source = "chat",
): Promise<void> {
  const text = content.trim().slice(0, 1000);
  if (!text) return;
  await supabase
    .from("agent_memories")
    .insert({ business_id: businessId, content: text, source, kind: "fact" });
}
