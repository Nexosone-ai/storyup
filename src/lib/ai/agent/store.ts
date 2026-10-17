import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

/**
 * AI 에이전트 데이터 접근 — 대화/메시지/제안. 모두 소유자 세션(RLS owns_business)으로
 * 수행되어 사업체/사용자별로 격리된다.
 */
export type DB = SupabaseClient<Database>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** 대화 id 확보 — 주어지면 소유 검증 후 사용, 없으면 새로 만든다. null이면 접근 불가. */
export async function getOrCreateConversation(
  supabase: DB,
  businessId: string,
  userId: string,
  conversationId?: string | null,
): Promise<string | null> {
  if (conversationId) {
    const { data } = await supabase
      .from("agent_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("business_id", businessId)
      .maybeSingle();
    return data?.id ?? null; // 다른 사업체/사용자 소유면 RLS로 안 잡혀 null
  }
  const { data, error } = await supabase
    .from("agent_conversations")
    .insert({ business_id: businessId, user_id: userId })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id;
}

/** 대화의 최근 메시지(오래된→최신). Claude 컨텍스트용 텍스트만. */
export async function loadMessages(
  supabase: DB,
  conversationId: string,
  limit = 20,
): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from("agent_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as ChatMessage[];
  return rows.reverse();
}

export async function saveMessage(
  supabase: DB,
  args: {
    conversationId: string;
    businessId: string;
    role: "user" | "assistant";
    content: string;
    toolJson?: Json | null;
  },
): Promise<void> {
  await supabase.from("agent_messages").insert({
    conversation_id: args.conversationId,
    business_id: args.businessId,
    role: args.role,
    content: args.content,
    tool_json: args.toolJson ?? null,
  });
  await supabase
    .from("agent_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", args.conversationId);
}

export interface ProposalInput {
  conversationId: string;
  businessId: string;
  action: string;
  params: Json;
}

export async function createProposal(
  supabase: DB,
  p: ProposalInput,
): Promise<string | null> {
  const { data } = await supabase
    .from("agent_proposals")
    .insert({
      conversation_id: p.conversationId,
      business_id: p.businessId,
      action: p.action,
      params: p.params,
      status: "pending",
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

export async function getProposal(supabase: DB, id: string) {
  const { data } = await supabase
    .from("agent_proposals")
    .select("id, business_id, action, params, status")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** pending → 지정 상태로 원자적 전환(동시/중복 실행 방지). 성공 시 true. */
export async function claimProposal(supabase: DB, id: string): Promise<boolean> {
  const { data } = await supabase
    .from("agent_proposals")
    .update({ status: "approved" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  return !!data;
}

export async function finishProposal(
  supabase: DB,
  id: string,
  status: "done" | "failed" | "rejected",
  result?: Json,
): Promise<void> {
  await supabase
    .from("agent_proposals")
    .update({ status, result: result ?? null })
    .eq("id", id);
}
