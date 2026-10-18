import { createClient, createAdminClient } from "@/lib/supabase/server";
import { partnerForClient } from "@/lib/partner";

export interface SupporterCard {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  bio: string | null;
  skills: string[];
  portfolio_url: string | null;
  contact: string | null;
  /** 월 기본가격(원). null = 미표기. 'agent' 역할에서 주로 사용. */
  base_price_krw: number | null;
  /** 현재 작업 현황(예: 수주 가능). */
  work_status: string | null;
  /** 경력/이력/포트폴리오 설명. */
  history: string | null;
  /** 승인 상태(pending|active|rejected). */
  status: string;
}

const PROFILE_COLS =
  "id,user_id,role,display_name,bio,skills,portfolio_url,contact,base_price_krw,work_status,history,status";

export type MySupporter = SupporterCard;

export interface ProjectRow {
  id: string;
  business_id: string;
  supporter_user_id: string;
  business_name: string;
  supporter_name: string;
  title: string;
  description: string | null;
  budget_points: number | null;
  status: string;
  created_at: string;
  asSupporter: boolean;
}

export async function getSupporterDirectory(): Promise<SupporterCard[]> {
  const supabase = await createClient();
  // 관리자가 승인(status='active')한 서포터만 노출한다. (신청→관리자 최종 승인)
  const { data } = await supabase
    .from("supporter_profiles")
    .select(PROFILE_COLS)
    .eq("status", "active")
    // 월정액 대행(agent)을 먼저 노출하고, 그 안에서 최신순.
    .order("base_price_krw", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getMySupporterProfile(
  userId: string,
): Promise<MySupporter | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("supporter_profiles")
    .select(PROFILE_COLS)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/** 특정 사용자(파트너)의 프로필 — 클라에게 담당자 정보로 노출(서비스롤 조회). */
export async function getSupporterProfileByUser(
  userId: string,
): Promise<SupporterCard | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("supporter_profiles")
    .select(PROFILE_COLS)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/** 현재 사용자(사업주)에게 배정된 대행 파트너의 프로필(없으면 null). */
export async function getAssignedPartnerProfile(
  userId: string,
): Promise<SupporterCard | null> {
  const partnerId = await partnerForClient(userId);
  if (!partnerId) return null;
  return getSupporterProfileByUser(partnerId);
}

export interface SupporterProfileInput {
  display_name: string;
  bio?: string;
  work_status?: string;
  history?: string;
  portfolio_url?: string;
  contact?: string;
  skills?: string[];
}

/** 본인(파트너/서포터) 프로필 생성·수정. RLS: 본인 행만. */
export async function upsertOwnSupporterProfile(
  userId: string,
  input: SupporterProfileInput,
): Promise<{ ok?: boolean; error?: string; status?: string }> {
  const supabase = await createClient();
  const name = input.display_name.trim();
  if (!name) return { error: "이름을 입력해주세요." };

  // 승인 상태는 본인이 바꾸지 못한다: 기존 상태 유지, 신규 신청은 pending.
  const { data: existing } = await supabase
    .from("supporter_profiles")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  const status = existing?.status ?? "pending";

  const { error } = await supabase.from("supporter_profiles").upsert(
    {
      user_id: userId,
      role: "agent",
      display_name: name,
      bio: input.bio?.trim() || null,
      work_status: input.work_status?.trim() || null,
      history: input.history?.trim() || null,
      portfolio_url: input.portfolio_url?.trim() || null,
      contact: input.contact?.trim() || null,
      skills: input.skills ?? [],
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: "프로필 저장에 실패했습니다." };
  return { ok: true, status };
}

// ---------------- 관리자 승인 ----------------

export interface PendingSupporter {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  work_status: string | null;
  history: string | null;
  portfolio_url: string | null;
  contact: string | null;
  email: string | null;
}
/** 승인 대기(pending) 서포터 신청 목록(관리자). */
export async function listPendingSupporters(): Promise<PendingSupporter[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("supporter_profiles")
    .select(
      "id,user_id,display_name,bio,work_status,history,portfolio_url,contact",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const ids = rows.map((r) => r.user_id);
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("user_id, email").in("user_id", ids)
    : { data: [] };
  const emailMap = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));
  return rows.map((r) => ({ ...r, email: emailMap.get(r.user_id) ?? null }));
}

/** 서포터 신청 승인/반려(관리자). */
export async function setSupporterStatus(
  id: string,
  status: "active" | "rejected",
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("supporter_profiles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function getBusinessOptions(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("id,name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getMyProjects(userId: string): Promise<ProjectRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("collaboration_projects")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((p) => ({
    ...p,
    asSupporter: p.supporter_user_id === userId,
  }));
}
