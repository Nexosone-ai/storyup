"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createAnnouncement,
  updateAnnouncement,
  setAnnouncementActive,
  deleteAnnouncement,
  type AnnouncementInput,
} from "@/lib/admin/announcements";

export interface AnnouncementState {
  ok?: boolean;
  error?: string;
  message?: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, admin: !!data?.is_admin };
}

const trimOrNull = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s ? s : null;
};

/** 폼 payload → 검증된 AnnouncementInput. 문제가 있으면 error 문자열 반환. */
function validate(raw: {
  title: string;
  body: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
}): { input?: AnnouncementInput; error?: string } {
  const title = raw.title.trim();
  const body = raw.body.trim();
  if (!title) return { error: "제목을 입력해주세요." };
  if (!body) return { error: "내용을 입력해주세요." };

  const startMs = Date.parse(raw.startsAt);
  const endMs = Date.parse(raw.endsAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs))
    return { error: "노출 시작·종료 일시를 정확히 입력해주세요." };
  if (endMs <= startMs)
    return { error: "종료 일시는 시작 일시보다 뒤여야 합니다." };

  const linkUrl = trimOrNull(raw.linkUrl);
  if (linkUrl && !/^(https?:\/\/|\/)/i.test(linkUrl))
    return { error: "버튼 링크는 http(s):// 또는 / 로 시작해야 합니다." };
  // 링크가 있으면 문구 기본값 채움
  const linkLabel = linkUrl
    ? (trimOrNull(raw.linkLabel) ?? "자세히 보기")
    : null;

  return {
    input: {
      title,
      body,
      imageUrl: trimOrNull(raw.imageUrl),
      linkUrl,
      linkLabel,
      startsAt: new Date(startMs).toISOString(),
      endsAt: new Date(endMs).toISOString(),
      active: !!raw.active,
    },
  };
}

/** 공지 생성/수정 — id가 있으면 수정, 없으면 생성. */
export async function saveAnnouncementAction(
  id: string | null,
  raw: {
    title: string;
    body: string;
    imageUrl?: string | null;
    linkUrl?: string | null;
    linkLabel?: string | null;
    startsAt: string;
    endsAt: string;
    active: boolean;
  },
): Promise<AnnouncementState> {
  const { user, admin } = await requireAdmin();
  if (!admin || !user) return { error: "권한이 없습니다." };

  const { input, error } = validate(raw);
  if (error || !input) return { error: error ?? "입력을 확인해주세요." };

  const res = id
    ? await updateAnnouncement(id, input)
    : await createAnnouncement(input, user.id);
  if (res.error) return { error: res.error };

  revalidatePath("/dashboard/admin/announcements");
  revalidatePath("/dashboard");
  return { ok: true, message: id ? "공지를 수정했습니다." : "공지를 등록했습니다." };
}

/** 활성/비활성 토글. */
export async function setAnnouncementActiveAction(
  id: string,
  active: boolean,
): Promise<AnnouncementState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const res = await setAnnouncementActive(id, active);
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/admin/announcements");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** 공지 삭제. */
export async function deleteAnnouncementAction(
  id: string,
): Promise<AnnouncementState> {
  const { admin } = await requireAdmin();
  if (!admin) return { error: "권한이 없습니다." };
  const res = await deleteAnnouncement(id);
  if (res.error) return { error: res.error };
  revalidatePath("/dashboard/admin/announcements");
  revalidatePath("/dashboard");
  return { ok: true, message: "삭제했습니다." };
}
