import type { DB } from "./store";
import { embed, toVectorLiteral } from "@/lib/ai/embeddings";

/**
 * 에이전트 장기 기억 — 사용자가 알려준 사실을 사업체 단위로 보관한다.
 * 저장 시 임베딩을 함께 계산해 두고(베스트에포트), 매 턴 질의와 의미가 가까운
 * 비폐기 기억을 주입한다(searchMemories). 임베딩 미설정 시 최근순 폴백.
 */

/** 최근순 비폐기 기억(임베딩 불가 시 폴백 경로). */
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

/** 질의와 의미가 가까운 기억(시맨틱). 임베딩 없으면 최근순으로 폴백. */
export async function searchMemories(
  supabase: DB,
  businessId: string,
  queryText: string,
  limit = 8,
): Promise<string[]> {
  const vec = await embed(queryText);
  if (vec) {
    const { data, error } = await supabase.rpc("match_agent_memories", {
      p_business: businessId,
      p_query: toVectorLiteral(vec),
      p_count: limit,
    });
    if (!error && Array.isArray(data) && data.length)
      return data.map((r) => r.content);
  }
  return loadMemories(supabase, businessId, limit);
}

export async function saveMemory(
  supabase: DB,
  businessId: string,
  content: string,
  source = "chat",
): Promise<void> {
  const text = content.trim().slice(0, 1000);
  if (!text) return;
  const vec = await embed(text);
  await supabase.from("agent_memories").insert({
    business_id: businessId,
    content: text,
    source,
    kind: "fact",
    embedding: vec ? toVectorLiteral(vec) : null,
  });
}
