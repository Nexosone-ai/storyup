import { createAdminClient } from "@/lib/supabase/server";
import type { AnnouncementRow } from "@/types/database";

/**
 * 공지사항 팝업 — 관리자 작성, 로그인 사용자에게 기간 동안 팝업 표시.
 * 조회/쓰기 모두 service role(createAdminClient)로 수행하고, 권한은 서버 액션의
 * requireAdmin이 강제한다. (공개 노출 조회는 활성+기간 조건을 쿼리로 좁힌다.)
 */

/** 사용자 팝업에 넘길 최소 필드. */
export interface ActiveAnnouncement {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
}

/** 관리자 폼 입력값 (검증은 액션에서). */
export interface AnnouncementInput {
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  startsAt: string; // ISO
  endsAt: string; // ISO
  active: boolean;
}

/**
 * 지금 표시할 공지 1건 — 활성 + 노출 기간 내, 최신 우선.
 * 없거나 조회 실패(마이그레이션 전) 시 null. 대시보드 레이아웃에서 매 로드 호출.
 */
export async function getActiveAnnouncement(): Promise<ActiveAnnouncement | null> {
  try {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await admin
      .from("announcements")
      .select("id, title, body, image_url, link_url, link_label")
      .eq("active", true)
      .lte("starts_at", nowIso)
      .gte("ends_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      title: data.title,
      body: data.body,
      imageUrl: data.image_url,
      linkUrl: data.link_url,
      linkLabel: data.link_label,
    };
  } catch {
    return null;
  }
}

/** 관리자 목록 — 최신순. */
export async function listAnnouncementsAdmin(
  limit = 100,
): Promise<AnnouncementRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

function toRow(input: AnnouncementInput) {
  return {
    title: input.title,
    body: input.body,
    image_url: input.imageUrl,
    link_url: input.linkUrl,
    link_label: input.linkLabel,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    active: input.active,
  };
}

export async function createAnnouncement(
  input: AnnouncementInput,
  createdBy: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("announcements")
    .insert({ ...toRow(input), created_by: createdBy });
  if (error) {
    console.error("[announcements] create failed", error.message);
    return { error: "공지 저장에 실패했습니다. (0031 마이그레이션 확인)" };
  }
  return {};
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("announcements")
    .update(toRow(input))
    .eq("id", id);
  if (error) {
    console.error("[announcements] update failed", error.message);
    return { error: "공지 수정에 실패했습니다." };
  }
  return {};
}

export async function setAnnouncementActive(
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("announcements")
    .update({ active })
    .eq("id", id);
  return error ? { error: "상태 변경에 실패했습니다." } : {};
}

export async function deleteAnnouncement(
  id: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("announcements").delete().eq("id", id);
  return error ? { error: "삭제에 실패했습니다." } : {};
}
