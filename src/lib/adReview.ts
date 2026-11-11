import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { scanAdRisk, isThinContent, toPlainText } from "@/lib/blog/adRiskScan";

/**
 * 광고 게재 검수(0113) — 공개 발행(status)과 광고 게재 가능(ad_review_status)을 분리한다.
 * 회사(STORYUP) 애드센스 광고는 approved 글과, approved 글이 1개 이상인 사이트의 홈·목록에만 나온다.
 * 유료 사용자가 연결한 본인 애드센스는 본인 계정 책임이라 이 검수의 대상이 아니다.
 */
export type AdReviewStatus = "pending" | "approved" | "rejected";

export function isAdApproved(status: string | null | undefined): boolean {
  return status === "approved";
}

/** 사업장의 승인된 공개 글 수 — 사이트 홈·블로그 목록 광고 노출 판정. */
export async function countAdApprovedPosts(businessId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("blog_posts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "published")
    .eq("ad_review_status", "approved");
  return count ?? 0;
}

export interface AdReviewRow {
  id: string;
  title: string;
  slug: string;
  businessId: string;
  businessName: string;
  siteSlug: string | null;
  ownerEmail: string | null;
  /** 소유자 플랜 — free 면 회사 광고 대상. */
  ownerPlan: string;
  publishedAt: string | null;
  chars: number;
  thin: boolean;
  risks: ReturnType<typeof scanAdRisk>;
  adReviewStatus: AdReviewStatus;
  adReviewNote: string | null;
  adReviewedAt: string | null;
}

/** 관리자 — 발행 글 검수 목록(최신순). filter 로 상태 선택. */
export async function listAdReviewPosts(opts: {
  status?: AdReviewStatus | "all";
  limit?: number;
} = {}): Promise<AdReviewRow[]> {
  const admin = createAdminClient();
  let q = admin
    .from("blog_posts")
    .select(
      "id, title, slug, business_id, content, published_at, ad_review_status, ad_review_note, ad_reviewed_at",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.status && opts.status !== "all") q = q.eq("ad_review_status", opts.status);
  const { data: posts } = await q;
  if (!posts?.length) return [];

  const bizIds = [...new Set(posts.map((p) => p.business_id))];
  const [{ data: bizs }, { data: sites }] = await Promise.all([
    admin.from("businesses").select("id, name, user_id").in("id", bizIds),
    admin.from("websites").select("business_id, slug, status").in("business_id", bizIds),
  ]);
  const bizMap = new Map((bizs ?? []).map((b) => [b.id, b]));
  const siteMap = new Map(
    (sites ?? []).filter((s) => s.status === "published").map((s) => [s.business_id, s.slug]),
  );
  const ownerIds = [...new Set((bizs ?? []).map((b) => b.user_id))];
  const [{ data: profiles }, { data: subs }] = await Promise.all([
    admin.from("profiles").select("user_id, email").in("user_id", ownerIds),
    admin
      .from("subscriptions")
      .select("user_id, plan, status, current_period_end")
      .in("user_id", ownerIds),
  ]);
  const emailMap = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));
  const now = Date.now();
  const planMap = new Map<string, string>();
  for (const s of subs ?? []) {
    const active =
      s.status === "active" &&
      (!s.current_period_end || new Date(s.current_period_end).getTime() > now);
    planMap.set(s.user_id, active ? s.plan : "free");
  }

  return posts.map((p) => {
    const biz = bizMap.get(p.business_id);
    const content = p.content ?? "";
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      businessId: p.business_id,
      businessName: biz?.name ?? "",
      siteSlug: siteMap.get(p.business_id) ?? null,
      ownerEmail: biz ? (emailMap.get(biz.user_id) ?? null) : null,
      ownerPlan: biz ? (planMap.get(biz.user_id) ?? "free") : "free",
      publishedAt: p.published_at,
      chars: toPlainText(content).replace(/\s/g, "").length,
      thin: isThinContent(content),
      risks: scanAdRisk(content),
      adReviewStatus: (p.ad_review_status as AdReviewStatus) ?? "pending",
      adReviewNote: p.ad_review_note,
      adReviewedAt: p.ad_reviewed_at,
    };
  });
}

/** 관리자 — 검수 상태 변경(승인/반려/대기). 호출 전 isCurrentUserAdmin() 확인. */
export async function setAdReviewStatus(
  postId: string,
  status: AdReviewStatus,
  note: string | null,
  adminUserId: string | null,
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("blog_posts")
    .update({
      ad_review_status: status,
      ad_review_note: note?.trim() || null,
      ad_reviewed_at: status === "pending" ? null : new Date().toISOString(),
      ad_reviewed_by: status === "pending" ? null : adminUserId,
    })
    .eq("id", postId);
  if (error) {
    console.error("[ad-review] update failed", error.message);
    return { error: "검수 상태 저장에 실패했어요(0113 마이그레이션 적용 확인)." };
  }
  return {};
}

/** 관리자 대시보드 요약. */
export async function adReviewSummary(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
}> {
  const admin = createAdminClient();
  const count = async (s: AdReviewStatus) =>
    (
      await admin
        .from("blog_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .eq("ad_review_status", s)
    ).count ?? 0;
  const [pending, approved, rejected] = await Promise.all([
    count("pending"),
    count("approved"),
    count("rejected"),
  ]);
  return { pending, approved, rejected };
}
