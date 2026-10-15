import { createAdminClient } from "@/lib/supabase/server";
import { getPlanId, currentPeriod } from "@/lib/subscription";

/**
 * 무료 플랜 블로그 이용권 — 하루 1개 / 한 달 30개, 월 단위 재신청(관리자 승인).
 * 각 이용 기간은 free_grants 1행([period_start, period_end]). 첫 기간은 첫 글
 * 작성 시 자동 발급(승인 불필요), 이후 갱신은 재신청(pending) → 관리자 승인.
 * 마이그레이션 0060 적용 전에는 모든 함수가 '막지 않음'으로 수렴해 기존 동작 유지.
 */

export const FREE_BLOG_DAILY = 1;
export const FREE_BLOG_MONTHLY = 30;

export type FreeBlogCode = "expired" | "pending" | "daily" | "monthly";

/** 무료 블로그 한도/이용권 초과 — 사용자에게 보여줄 메시지 + 상태 코드. */
export class FreeBlogLimitError extends Error {
  constructor(
    public readonly code: FreeBlogCode,
    message: string,
  ) {
    super(message);
    this.name = "FreeBlogLimitError";
  }
}

interface GrantRow {
  id: string;
  status: "active" | "pending" | "rejected";
  period_start: string | null;
  period_end: string | null;
}

/** 서울 기준 오늘 00:00 ISO. */
function startOfTodaySeoulIso(): string {
  const d = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${d}T00:00:00+09:00`;
}

function addOneMonthIso(fromIso: string): string {
  const d = new Date(fromIso);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/** 최신 free_grants 1행. 테이블 미존재/오류면 undefined(=아직 시스템 없음). */
async function latestGrant(userId: string): Promise<GrantRow | null | undefined> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("free_grants")
    .select("id, status, period_start, period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return undefined; // 마이그레이션 전 등 — 판단 불가
  return (data as GrantRow | null) ?? null;
}

/** usage_events(blog_post) 건수 — since 이후. */
async function countBlogSince(userId: string, sinceIso: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "blog_post")
    .gte("created_at", sinceIso);
  return count ?? 0;
}

export interface FreeBlogStatus {
  isFree: boolean;
  /** 지금 글을 쓸 수 있는지(활성 이용권 + 한도 내). */
  canWrite: boolean;
  /** 재신청이 필요한 상태(기간 만료 또는 반려). */
  needsReapply: boolean;
  /** 재신청 후 관리자 승인 대기 중. */
  pending: boolean;
  periodEnd: string | null;
  usedDaily: number;
  usedMonthly: number;
  dailyLimit: number;
  monthlyLimit: number;
}

/** 블로그 섹션 표시용 무료 이용권 상태(읽기 전용 — 행을 만들지 않는다). */
export async function getFreeBlogStatus(userId: string): Promise<FreeBlogStatus> {
  const base: FreeBlogStatus = {
    isFree: false,
    canWrite: true,
    needsReapply: false,
    pending: false,
    periodEnd: null,
    usedDaily: 0,
    usedMonthly: 0,
    dailyLimit: FREE_BLOG_DAILY,
    monthlyLimit: FREE_BLOG_MONTHLY,
  };
  const planId = await getPlanId(userId);
  if (planId !== "free") return base;

  const grant = await latestGrant(userId);
  if (grant === undefined) return base; // 시스템 미구축 — 표시 안 함(기존 동작)

  const now = Date.now();
  const active =
    grant &&
    grant.status === "active" &&
    (!grant.period_end || new Date(grant.period_end).getTime() > now);
  const periodStart = grant?.period_start ?? currentPeriod().startIso;

  const [usedMonthly, usedDaily] = await Promise.all([
    countBlogSince(userId, periodStart),
    countBlogSince(userId, startOfTodaySeoulIso()),
  ]);

  const pending = !!grant && grant.status === "pending";
  // 활성 이용권이 없고(만료/반려), 대기 중도 아니면 재신청 필요. 이용권이 아예
  // 없으면(grant=null) 첫 글 작성 시 자동 발급되므로 아직 쓸 수 있다.
  const expiredOrRejected =
    !!grant && !active && !pending; // active 아님 + pending 아님 = 만료/반려
  const canWrite =
    !pending &&
    !expiredOrRejected &&
    usedDaily < FREE_BLOG_DAILY &&
    usedMonthly < FREE_BLOG_MONTHLY;

  return {
    isFree: true,
    canWrite,
    needsReapply: expiredOrRejected,
    pending,
    periodEnd: active ? (grant?.period_end ?? null) : null,
    usedDaily,
    usedMonthly,
    dailyLimit: FREE_BLOG_DAILY,
    monthlyLimit: FREE_BLOG_MONTHLY,
  };
}

export interface FreeBlogConsume {
  charged: 0;
  refund: () => Promise<void>;
}

/**
 * 무료 플랜이면 블로그 이용권/한도를 검증하고 사용 1건을 기록한다.
 * - 무료가 아니면 null(호출부가 기존 제공량 경로로 진행).
 * - 시스템 미구축(0060 전)이면 null(막지 않음).
 * - 막혀야 하면 FreeBlogLimitError throw.
 */
export async function consumeFreeBlogIfApplicable(
  userId: string,
  ko: boolean,
): Promise<FreeBlogConsume | null> {
  const planId = await getPlanId(userId);
  if (planId !== "free") return null;

  const admin = createAdminClient();
  const grant = await latestGrant(userId);
  if (grant === undefined) return null; // 0060 전 — 기존 경로로

  const now = Date.now();
  let periodStart: string;

  if (!grant) {
    // 첫 이용 기간 자동 발급(승인 불필요).
    const startIso = new Date().toISOString();
    const { error } = await admin.from("free_grants").insert({
      user_id: userId,
      status: "active",
      period_start: startIso,
      period_end: addOneMonthIso(startIso),
      approved_at: startIso,
    });
    if (error) return null; // 발급 실패 — 막지 않음
    periodStart = startIso;
  } else if (grant.status === "pending") {
    throw new FreeBlogLimitError(
      "pending",
      ko
        ? "재신청이 접수되어 관리자 승인을 기다리고 있어요. 승인되면 다시 작성할 수 있습니다."
        : "Your renewal is awaiting admin approval.",
    );
  } else if (
    grant.status === "active" &&
    (!grant.period_end || new Date(grant.period_end).getTime() > now)
  ) {
    periodStart = grant.period_start ?? new Date().toISOString();
  } else {
    // 만료 또는 반려 → 재신청 필요
    throw new FreeBlogLimitError(
      "expired",
      ko
        ? "무료 이용 기간이 끝났어요. '재신청'을 눌러 관리자 승인을 받으면 한 달 더 이용할 수 있어요."
        : "Your free month has ended. Press 'Re-apply' to request another month.",
    );
  }

  // 한도 검사(일·월)
  const [usedDaily, usedMonthly] = await Promise.all([
    countBlogSince(userId, startOfTodaySeoulIso()),
    countBlogSince(userId, periodStart),
  ]);
  if (usedDaily >= FREE_BLOG_DAILY)
    throw new FreeBlogLimitError(
      "daily",
      ko
        ? "무료 플랜은 하루에 1개까지 쓸 수 있어요. 내일 다시 이용해주세요."
        : "The free plan allows 1 post per day. Please try again tomorrow.",
    );
  if (usedMonthly >= FREE_BLOG_MONTHLY)
    throw new FreeBlogLimitError(
      "monthly",
      ko
        ? `이번 달 무료 한도(${FREE_BLOG_MONTHLY}개)를 모두 사용했어요.`
        : `You've used this month's free quota (${FREE_BLOG_MONTHLY}).`,
    );

  // 사용 1건 기록
  const { data: ev } = await admin
    .from("usage_events")
    .insert({ user_id: userId, kind: "blog_post", charged: 0 })
    .select("id")
    .single();

  return {
    charged: 0,
    refund: async () => {
      if (ev?.id) await admin.from("usage_events").delete().eq("id", ev.id);
    },
  };
}

/** 사용자가 '재신청'을 눌렀을 때 — 대기(pending) 이용권을 1건 만든다. */
export async function requestFreeReapply(
  userId: string,
  ko: boolean,
): Promise<{ ok?: true; error?: string }> {
  const planId = await getPlanId(userId);
  if (planId !== "free")
    return { error: ko ? "무료 플랜만 재신청할 수 있어요." : "Free plan only." };

  const grant = await latestGrant(userId);
  if (grant === undefined)
    return { error: ko ? "잠시 후 다시 시도해주세요." : "Please try again later." };

  const now = Date.now();
  if (grant && grant.status === "pending")
    return { error: ko ? "이미 승인 대기 중이에요." : "Already pending approval." };
  if (
    grant &&
    grant.status === "active" &&
    (!grant.period_end || new Date(grant.period_end).getTime() > now)
  )
    return {
      error: ko ? "아직 이용 기간이 남아 있어요." : "Your period is still active.",
    };

  const admin = createAdminClient();
  const { error } = await admin.from("free_grants").insert({
    user_id: userId,
    status: "pending",
    requested_at: new Date().toISOString(),
  });
  if (error) return { error: ko ? "재신청에 실패했어요." : "Re-apply failed." };
  return { ok: true };
}

// ---------------- 관리자 ----------------

export interface FreeReapplyRow {
  id: string;
  userId: string;
  email: string | null;
  status: "active" | "pending" | "rejected";
  requestedAt: string | null;
  createdAt: string;
}

/** 관리자 — 재신청(대기) 목록 + 최근 처리 내역. */
export async function listFreeReapplies(limit = 100): Promise<FreeReapplyRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("free_grants")
    .select("id, user_id, status, requested_at, created_at")
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    status: "active" | "pending" | "rejected";
    requested_at: string | null;
    created_at: string;
  }>;
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const emailBy = new Map<string, string | null>();
  await Promise.all(
    ids.map(async (uid) => {
      try {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        emailBy.set(uid, u.user?.email ?? null);
      } catch {
        emailBy.set(uid, null);
      }
    }),
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: emailBy.get(r.user_id) ?? null,
    status: r.status,
    requestedAt: r.requested_at,
    createdAt: r.created_at,
  }));
}

/** 관리자 — 재신청 승인: 해당 행을 active + 1개월 기간으로 전환. */
export async function approveFreeReapply(
  grantId: string,
  adminId: string,
): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const startIso = new Date().toISOString();
  const { error } = await admin
    .from("free_grants")
    .update({
      status: "active",
      period_start: startIso,
      period_end: addOneMonthIso(startIso),
      approved_at: startIso,
      approved_by: adminId,
    })
    .eq("id", grantId)
    .eq("status", "pending");
  if (error) return { error: "승인에 실패했습니다." };
  return { ok: true };
}

/** 관리자 — 재신청 반려. */
export async function rejectFreeReapply(
  grantId: string,
): Promise<{ ok?: true; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("free_grants")
    .update({ status: "rejected" })
    .eq("id", grantId)
    .eq("status", "pending");
  if (error) return { error: "반려에 실패했습니다." };
  return { ok: true };
}
