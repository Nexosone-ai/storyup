"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import type { Json } from "@/types/database";

export interface RoutineInput {
  id?: string;
  kind: "blog" | "cardnews" | "facebook";
  cadence: "daily" | "weekly" | "biweekly" | "monthly";
  autonomy: "propose" | "auto";
  enabled: boolean;
  maxPerDay: number;
  monthlyCap: number;
  quietStart: number | null;
  quietEnd: number | null;
  topic?: string;
  message?: string;
}

export interface RoutineState {
  ok?: boolean;
  error?: string;
}

const CADENCE = new Set(["daily", "weekly", "biweekly", "monthly"]);
const KIND = new Set(["blog", "cardnews", "facebook"]);
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

  const row = {
    business_id: businessId,
    kind: input.kind,
    cadence: input.cadence,
    autonomy: input.autonomy === "auto" ? ("auto" as const) : ("propose" as const),
    enabled: !!input.enabled,
    max_per_day: clampInt(input.maxPerDay, 1, 20),
    monthly_cap: clampInt(input.monthlyCap, 0, 200),
    quiet_start: clampHour(input.quietStart),
    quiet_end: clampHour(input.quietEnd),
    params: params as Json,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    // 비활성→활성 전환 시 곧 실행되도록 next_run_at을 현재로.
    const { data: prev } = await supabase
      .from("agent_routines")
      .select("enabled")
      .eq("id", input.id)
      .eq("business_id", businessId)
      .maybeSingle();
    const reactivated = row.enabled && prev && !prev.enabled;
    const { error } = await supabase
      .from("agent_routines")
      .update(reactivated ? { ...row, next_run_at: new Date().toISOString() } : row)
      .eq("id", input.id)
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
