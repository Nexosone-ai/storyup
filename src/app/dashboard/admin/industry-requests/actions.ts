"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/points";
import { createSystemNotification } from "@/lib/notifications";
import { stripHtml } from "@/utils/richtext";
import { slugWithFallback } from "@/utils/slug";

export interface ReviewState {
  ok?: boolean;
  error?: string;
}

type Status = "received" | "reviewing" | "adopted" | "rejected";
const STATUSES = new Set<Status>(["received", "reviewing", "adopted", "rejected"]);

async function adminUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** 요청 상태 변경 + 내부 메모/공개 답변 저장 + 처리 이력 기록 + (답변 시) 신청자 알림. */
export async function reviewIndustryRequestAction(
  id: string,
  input: { status: Status; adminNote?: string; publicReply?: string },
): Promise<ReviewState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  if (!STATUSES.has(input.status)) return { error: "잘못된 상태입니다." };
  const actor = await adminUserId();
  const admin = createAdminClient();

  const { data: cur } = await admin
    .from("industry_requests")
    .select("id, user_id, status, name")
    .eq("id", id)
    .maybeSingle();
  if (!cur) return { error: "요청을 찾을 수 없습니다." };

  const adminNote = input.adminNote ? stripHtml(input.adminNote).trim().slice(0, 1000) : undefined;
  const publicReply = input.publicReply
    ? stripHtml(input.publicReply).trim().slice(0, 1000)
    : undefined;

  const { error } = await admin
    .from("industry_requests")
    .update({
      status: input.status,
      ...(adminNote !== undefined ? { admin_note: adminNote } : {}),
      ...(publicReply !== undefined ? { public_reply: publicReply } : {}),
      reviewed_by: actor,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "저장에 실패했어요." };

  // 처리 이력(감사).
  await admin.from("industry_request_events").insert({
    request_id: id,
    from_status: cur.status,
    to_status: input.status,
    actor_id: actor,
    note: adminNote ?? null,
  });

  // 결과(채택·반려)에 공개 답변이 있으면 신청자에게 인앱 알림.
  if (publicReply && (input.status === "adopted" || input.status === "rejected")) {
    await createSystemNotification(admin, {
      userId: cur.user_id,
      type: "industry_request",
      title: `업종 추가 요청 결과: ${cur.name}`,
      message: publicReply,
      dedupKey: `industry_request:${id}:${input.status}`,
    });
  }

  revalidatePath("/dashboard/admin/industry-requests");
  return { ok: true };
}

/**
 * 요청 채택 → 업종 초안 생성·연결(발행은 별도 단계). 상태 'adopted'로 전환 + 이력 + 알림.
 * 이미 연결된 업종이 있으면 중복 생성하지 않는다.
 */
export async function adoptRequestAction(
  id: string,
  input: { nameKo: string; publicReply?: string },
): Promise<ReviewState> {
  if (!(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const actor = await adminUserId();
  const admin = createAdminClient();

  const { data: cur } = await admin
    .from("industry_requests")
    .select("id, user_id, status, name, linked_industry_id")
    .eq("id", id)
    .maybeSingle();
  if (!cur) return { error: "요청을 찾을 수 없습니다." };

  const nameKo = stripHtml(input.nameKo || cur.name).trim().slice(0, 60);
  if (!nameKo) return { error: "업종명을 입력해주세요." };

  let industryId = cur.linked_industry_id as string | null;
  if (!industryId) {
    // 업종 초안 생성(비공개). slug 중복 회피.
    const base = slugWithFallback(nameKo, "industry");
    let slug = base;
    const { data: dup } = await admin
      .from("industries")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (dup) slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: created, error: cErr } = await admin
      .from("industries")
      .insert({ slug, name_ko: nameKo, status: "draft" })
      .select("id")
      .single();
    if (cErr || !created) return { error: "업종 초안 생성에 실패했어요." };
    industryId = created.id;
  }

  const { error } = await admin
    .from("industry_requests")
    .update({
      status: "adopted",
      linked_industry_id: industryId,
      reviewed_by: actor,
      reviewed_at: new Date().toISOString(),
      ...(input.publicReply
        ? { public_reply: stripHtml(input.publicReply).trim().slice(0, 1000) }
        : {}),
    })
    .eq("id", id);
  if (error) return { error: "저장에 실패했어요." };

  await admin.from("industry_request_events").insert({
    request_id: id,
    from_status: cur.status,
    to_status: "adopted",
    actor_id: actor,
    note: `업종 초안 생성/연결 (${industryId})`,
  });

  await createSystemNotification(admin, {
    userId: cur.user_id,
    type: "industry_request",
    title: `업종 추가 요청 채택: ${cur.name}`,
    message:
      input.publicReply ||
      "요청하신 업종을 반영하기로 했어요. 준비되는 대로 공개됩니다.",
    dedupKey: `industry_request:${id}:adopted`,
  });

  revalidatePath("/dashboard/admin/industry-requests");
  revalidatePath("/dashboard/admin/industries");
  return { ok: true };
}
