"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import {
  extractUrlText,
  SourceFetchError,
  MAX_SOURCE_CHARS,
  MAX_SOURCES,
} from "@/lib/ai/agent/sources";
import type { Json } from "@/types/database";

export interface RoutineInput {
  id?: string;
  kind: "blog" | "cardnews" | "facebook";
  cadence: "daily" | "weekly" | "biweekly" | "monthly";
  autonomy: "propose" | "auto" | "review";
  enabled: boolean;
  maxPerDay: number;
  monthlyCap: number;
  quietStart: number | null;
  quietEnd: number | null;
  reviewHours?: number;
  topic?: string;
  message?: string;
}

export interface RoutineState {
  ok?: boolean;
  error?: string;
}

const CADENCE = new Set(["daily", "weekly", "biweekly", "monthly"]);
const KIND = new Set(["blog", "cardnews", "facebook"]);
const AUTONOMY = new Set(["propose", "auto", "review"]);
const clampInt = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(Number.isFinite(v) ? v : lo)));
const clampHour = (v: number | null) =>
  v == null ? null : Math.max(0, Math.min(23, Math.round(v)));

async function guard(businessId: string) {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  const business = await getBusiness(businessId);
  if (!business) return { error: ko ? "권한이 없습니다." : "No permission." };
  const plan = getPlanById(await getPlanId(user.id));
  if (!plan.aiAgent)
    return {
      error: ko
        ? "오토파일럿은 Pro 플랜에서 사용할 수 있어요."
        : "Autopilot is available on the Pro plan.",
    };
  return { supabase, ko };
}

/** 루틴 생성/수정(사업장당 kind별 1개 관리). */
export async function upsertRoutineAction(
  businessId: string,
  input: RoutineInput,
): Promise<RoutineState> {
  const g = await guard(businessId);
  if ("error" in g) return { error: g.error };
  const { supabase } = g;
  if (!KIND.has(input.kind) || !CADENCE.has(input.cadence))
    return { error: g.ko ? "잘못된 설정입니다." : "Invalid settings." };

  const params: Record<string, unknown> = {};
  if (input.kind === "blog" && input.topic?.trim())
    params.topic = input.topic.trim().slice(0, 200);
  if (input.kind === "facebook" && input.message?.trim())
    params.message = input.message.trim().slice(0, 500);

  // 'review'(검토 후 예약발행)는 블로그에서만 — 그 외 종류는 auto/propose만.
  const autonomy = AUTONOMY.has(input.autonomy)
    ? input.autonomy === "review" && input.kind !== "blog"
      ? "auto"
      : input.autonomy
    : "propose";

  const row = {
    business_id: businessId,
    kind: input.kind,
    cadence: input.cadence,
    autonomy: autonomy as "propose" | "auto" | "review",
    enabled: !!input.enabled,
    max_per_day: clampInt(input.maxPerDay, 1, 20),
    monthly_cap: clampInt(input.monthlyCap, 0, 200),
    quiet_start: clampHour(input.quietStart),
    quiet_end: clampHour(input.quietEnd),
    review_hours: clampInt(input.reviewHours ?? 24, 1, 168),
    params: params as Json,
    updated_at: new Date().toISOString(),
  };

  // (사업장 × 종류)당 루틴은 하나 — id 전달 여부와 무관하게 '있으면 업데이트, 없으면 추가'로
  // 멱등 처리한다(중복 생성 방지). 기존 id가 없어도 kind로 기존 행을 찾아 갱신한다.
  const { data: prev } = await supabase
    .from("agent_routines")
    .select("id, enabled")
    .eq("business_id", businessId)
    .eq("kind", input.kind)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prev) {
    // 비활성→활성 전환 시 곧 실행되도록 next_run_at을 현재로.
    const reactivated = row.enabled && !prev.enabled;
    const { error } = await supabase
      .from("agent_routines")
      .update(reactivated ? { ...row, next_run_at: new Date().toISOString() } : row)
      .eq("id", prev.id)
      .eq("business_id", businessId);
    if (error) return { error: g.ko ? "저장에 실패했어요." : "Save failed." };
  } else {
    const { error } = await supabase.from("agent_routines").insert({
      ...row,
      next_run_at: new Date().toISOString(),
    });
    if (error) return { error: g.ko ? "저장에 실패했어요." : "Save failed." };
  }

  revalidatePath(`/business/${businessId}/agent/autopilot`);
  return { ok: true };
}

export async function deleteRoutineAction(
  businessId: string,
  routineId: string,
): Promise<RoutineState> {
  const g = await guard(businessId);
  if ("error" in g) return { error: g.error };
  await g.supabase
    .from("agent_routines")
    .delete()
    .eq("id", routineId)
    .eq("business_id", businessId);
  revalidatePath(`/business/${businessId}/agent/autopilot`);
  return { ok: true };
}

// ---------------- 글감 소스(URL/PDF) 관리 ----------------

export interface SourceState {
  ok?: boolean;
  error?: string;
}

async function sourceCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
): Promise<number> {
  const { count } = await supabase
    .from("agent_blog_sources")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  return count ?? 0;
}

/** URL 글감 추가 — 서버가 안전하게 본문을 가져와 텍스트로 저장. */
export async function addUrlSourceAction(
  businessId: string,
  url: string,
): Promise<SourceState> {
  const g = await guard(businessId);
  if ("error" in g) return { error: g.error };
  const { supabase, ko } = g;

  if ((await sourceCount(supabase, businessId)) >= MAX_SOURCES)
    return {
      error: ko
        ? `글감은 최대 ${MAX_SOURCES}개까지 등록할 수 있어요.`
        : `Up to ${MAX_SOURCES} sources.`,
    };

  let extracted;
  try {
    extracted = await extractUrlText(url.trim());
  } catch (e) {
    if (e instanceof SourceFetchError) return { error: e.message };
    console.error("[autopilot] url source failed", e);
    return { error: ko ? "주소를 가져오지 못했어요." : "Failed to fetch URL." };
  }

  const { error } = await supabase.from("agent_blog_sources").insert({
    business_id: businessId,
    kind: "url",
    url: extracted.url,
    title: extracted.title.slice(0, 200),
    text: extracted.text,
    char_count: extracted.text.length,
  });
  if (error) return { error: ko ? "저장에 실패했어요." : "Save failed." };

  revalidatePath(`/business/${businessId}/agent/autopilot`);
  return { ok: true };
}

/** PDF 글감 추가 — 브라우저에서 추출한 텍스트를 받아 저장(바이트는 서버를 거치지 않음). */
export async function addPdfSourceAction(
  businessId: string,
  title: string,
  text: string,
): Promise<SourceState> {
  const g = await guard(businessId);
  if ("error" in g) return { error: g.error };
  const { supabase, ko } = g;

  const body = (text ?? "").trim().slice(0, MAX_SOURCE_CHARS);
  if (body.length < 80)
    return {
      error: ko
        ? "PDF에서 읽은 텍스트가 너무 적어요(이미지 PDF는 지원 안 돼요)."
        : "Too little text extracted from the PDF.",
    };
  if ((await sourceCount(supabase, businessId)) >= MAX_SOURCES)
    return {
      error: ko
        ? `글감은 최대 ${MAX_SOURCES}개까지 등록할 수 있어요.`
        : `Up to ${MAX_SOURCES} sources.`,
    };

  const { error } = await supabase.from("agent_blog_sources").insert({
    business_id: businessId,
    kind: "pdf",
    url: null,
    title: (title || "PDF 문서").slice(0, 200),
    text: body,
    char_count: body.length,
  });
  if (error) return { error: ko ? "저장에 실패했어요." : "Save failed." };

  revalidatePath(`/business/${businessId}/agent/autopilot`);
  return { ok: true };
}

export async function removeSourceAction(
  businessId: string,
  sourceId: string,
): Promise<SourceState> {
  const g = await guard(businessId);
  if ("error" in g) return { error: g.error };
  await g.supabase
    .from("agent_blog_sources")
    .delete()
    .eq("id", sourceId)
    .eq("business_id", businessId);
  revalidatePath(`/business/${businessId}/agent/autopilot`);
  return { ok: true };
}

// ---------------- 검토 큐(예약된 자동 초안) 관리 ----------------

/** 검토 중 초안을 지금 바로 발행. */
export async function publishReviewNowAction(
  businessId: string,
  postId: string,
): Promise<SourceState> {
  const g = await guard(businessId);
  if ("error" in g) return { error: g.error };
  const { error } = await g.supabase
    .from("blog_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      scheduled_at: null,
    })
    .eq("id", postId)
    .eq("business_id", businessId)
    .eq("status", "draft");
  if (error) return { error: g.ko ? "발행에 실패했어요." : "Publish failed." };
  revalidatePath(`/business/${businessId}/agent/autopilot`);
  revalidatePath(`/business/${businessId}/blog`);
  return { ok: true };
}

/** 예약 발행을 보류 — 초안으로 남겨 자동 발행되지 않게 한다(검토 큐에서 내려감). */
export async function holdReviewAction(
  businessId: string,
  postId: string,
): Promise<SourceState> {
  const g = await guard(businessId);
  if ("error" in g) return { error: g.error };
  const { error } = await g.supabase
    .from("blog_posts")
    .update({ scheduled_at: null })
    .eq("id", postId)
    .eq("business_id", businessId)
    .eq("status", "draft");
  if (error) return { error: g.ko ? "처리에 실패했어요." : "Failed." };
  revalidatePath(`/business/${businessId}/agent/autopilot`);
  return { ok: true };
}

/** 검토 중 초안을 삭제. */
export async function discardReviewAction(
  businessId: string,
  postId: string,
): Promise<SourceState> {
  const g = await guard(businessId);
  if ("error" in g) return { error: g.error };
  await g.supabase
    .from("blog_posts")
    .delete()
    .eq("id", postId)
    .eq("business_id", businessId)
    .eq("status", "draft");
  revalidatePath(`/business/${businessId}/agent/autopilot`);
  return { ok: true };
}
