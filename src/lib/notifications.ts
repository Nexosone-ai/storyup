import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationRow } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

type Admin = SupabaseClient<Database>;

/**
 * 블로그 참여(댓글·좋아요) 발생 시 글 주인(가맹점)에게 앱 내 알림을 남긴다.
 * - 서버 액션에서 이미 검증을 마친 뒤 service-role 클라이언트로 호출한다.
 * - 본인이 자기 글에 남긴 경우(actorUserId === 주인)에는 알림을 만들지 않는다.
 * - 좋아요는 dedup_key로 같은 방문자·같은 글 중복 알림을 막는다.
 * 알림 생성 실패는 본 기능(댓글/좋아요) 성공을 막지 않으므로 조용히 삼킨다.
 */
export async function notifyBlogEngagement(
  admin: Admin,
  opts: {
    postId: string;
    type: NotificationRow["type"];
    actorName: string | null;
    preview?: string | null;
    /** 좋아요 중복 알림 방지용 방문자 키. 좋아요일 때만 사용. */
    visitorKey?: string | null;
    /** 참여자 로그인 user id — 주인 본인이면 알림 생략. */
    actorUserId?: string | null;
  },
): Promise<void> {
  try {
    const { data: post } = await admin
      .from("blog_posts")
      .select("id, business_id, title, slug, status")
      .eq("id", opts.postId)
      .maybeSingle();
    if (!post || post.status !== "published") return;

    const { data: biz } = await admin
      .from("businesses")
      .select("user_id")
      .eq("id", post.business_id)
      .maybeSingle();
    if (!biz) return;
    // 자기 글에 스스로 남긴 참여는 알리지 않는다.
    if (opts.actorUserId && opts.actorUserId === biz.user_id) return;

    const { data: site } = await admin
      .from("websites")
      .select("slug")
      .eq("business_id", post.business_id)
      .eq("status", "published")
      .maybeSingle();

    const dedupKey =
      opts.type === "blog_like" && opts.visitorKey
        ? `like:${post.id}:${opts.visitorKey}`
        : null;

    await admin.from("notifications").insert({
      user_id: biz.user_id,
      business_id: post.business_id,
      type: opts.type,
      post_id: post.id,
      post_title: post.title,
      site_slug: site?.slug ?? null,
      post_slug: post.slug,
      actor_name: opts.actorName,
      preview: opts.preview ?? null,
      dedup_key: dedupKey,
    });
  } catch {
    // 알림은 부가 기능 — 실패해도 원 동작을 방해하지 않는다.
  }
}

/** 로그인 사용자의 안 읽은 알림 개수 (헤더 배지용). */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  // 0018 마이그레이션 이전 DB에서는 테이블이 없어 오류 → 0으로 동작.
  if (error) return 0;
  return count ?? 0;
}

/** 로그인 사용자의 알림 목록 (최신순). */
export async function getNotifications(limit = 50): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
