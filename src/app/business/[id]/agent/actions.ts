"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { generateAndSaveBlog } from "@/lib/ai/generateBlog";
import { generateAndSaveCardNews } from "@/lib/ai/generateCardNews";
import { scheduleBlogAction } from "@/app/business/actions";
import { InsufficientPointsError } from "@/lib/ai/billing";
import { FreeBlogLimitError } from "@/lib/freeAccess";
import {
  getProposal,
  claimProposal,
  finishProposal,
} from "@/lib/ai/agent/store";
import type { BlogTone, BlogLength } from "@/types/domain";
import type { Json } from "@/types/database";

export interface AgentActionState {
  ok?: boolean;
  error?: string;
  result?: Record<string, unknown>;
}

/**
 * 에이전트 제안 승인 실행 — pending→approved 원자적 claim으로 중복 과금/실행을 막고,
 * 실제 작업(블로그 초안·카드뉴스·예약 발행)을 소유자 세션으로 수행한다.
 */
export async function executeAgentProposal(
  proposalId: string,
): Promise<AgentActionState> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const p = await getProposal(supabase, proposalId); // RLS: 본인 사업체 것만
  if (!p) return { error: ko ? "제안을 찾을 수 없습니다." : "Proposal not found." };
  if (p.status !== "pending")
    return {
      error: ko ? "이미 처리된 제안이에요." : "This proposal was already handled.",
    };
  if (!(await claimProposal(supabase, proposalId)))
    return {
      error: ko ? "이미 처리 중인 제안이에요." : "Proposal already in progress.",
    };

  const params = (p.params ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  try {
    let result: Record<string, unknown> = {};
    if (p.action === "generate_blog_draft") {
      const { postId, title } = await generateAndSaveBlog({
        supabase,
        userId: user.id,
        businessId: p.business_id,
        topic: str(params.topic),
        tone: (str(params.tone) || "Friendly") as BlogTone,
        length: (str(params.length) || "Medium") as BlogLength,
        locale: ko ? "ko" : "en",
      });
      result = { postId, title };
    } else if (p.action === "generate_cardnews") {
      const { cardNewsId } = await generateAndSaveCardNews({
        supabase,
        userId: user.id,
        businessId: p.business_id,
        blogPostId: str(params.blogPostId),
        locale: ko ? "ko" : "en",
      });
      result = { cardNewsId };
    } else if (p.action === "schedule_publish") {
      const res = await scheduleBlogAction(
        p.business_id,
        str(params.postId),
        str(params.scheduledAt),
      );
      if (res.error) throw new Error(res.error);
      result = { scheduled: true };
    } else {
      throw new Error("unknown action");
    }

    await finishProposal(supabase, proposalId, "done", result as unknown as Json);
    revalidatePath(`/business/${p.business_id}/blog`);
    return { ok: true, result };
  } catch (err) {
    await finishProposal(supabase, proposalId, "failed");
    if (err instanceof InsufficientPointsError || err instanceof FreeBlogLimitError)
      return { error: err.message };
    if (err instanceof Error && err.message && err.message.length < 200)
      return { error: err.message };
    return {
      error: ko ? "작업 실행에 실패했어요." : "Failed to run the action.",
    };
  }
}

/** 제안 거절(실행 안 함). */
export async function rejectAgentProposal(
  proposalId: string,
): Promise<AgentActionState> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  const p = await getProposal(supabase, proposalId);
  if (!p) return { error: ko ? "제안을 찾을 수 없습니다." : "Not found." };
  if (p.status === "pending")
    await finishProposal(supabase, proposalId, "rejected");
  return { ok: true };
}
