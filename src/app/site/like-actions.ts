"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notifyBlogEngagement } from "@/lib/notifications";

const VISITOR_COOKIE = "bl_vid";

/**
 * 공개 블로그 방문자의 익명 식별자. 로그인 사용자는 계정 기준,
 * 비로그인 방문자는 쿠키에 심은 UUID 기준으로 좋아요 중복을 막는다.
 */
async function getVisitorKey(userId: string | null): Promise<string> {
  if (userId) return `user:${userId}`;
  const store = await cookies();
  let vid = store.get(VISITOR_COOKIE)?.value;
  if (!vid) {
    vid = randomUUID();
    store.set(VISITOR_COOKIE, vid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1년
    });
  }
  return `anon:${vid}`;
}

export interface LikeState {
  liked: boolean;
  count: number;
  error?: string;
}

/** 공개 블로그 글의 좋아요 토글. 새로 누른 경우 글 주인에게 알림을 남긴다. */
export async function toggleBlogLikeAction(postId: string): Promise<LikeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const visitorKey = await getVisitorKey(user?.id ?? null);

  const admin = createAdminClient();
  const { data: post } = await admin
    .from("blog_posts")
    .select("id, business_id, status")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.status !== "published")
    return { liked: false, count: 0, error: "not_found" };

  const { data: existing } = await admin
    .from("blog_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("visitor_key", visitorKey)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    await admin.from("blog_likes").delete().eq("id", existing.id);
    liked = false;
  } else {
    await admin.from("blog_likes").insert({
      post_id: postId,
      business_id: post.business_id,
      visitor_key: visitorKey,
    });
    liked = true;
    // 좋아요를 새로 누른 경우에만 알림. dedup_key로 재클릭 중복은 무시된다.
    let actorName = "방문자";
    if (user) {
      const { data: profile } = await admin
        .from("profiles")
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();
      actorName = profile?.name || "방문자";
    }
    await notifyBlogEngagement(admin, {
      postId,
      type: "blog_like",
      actorName,
      visitorKey,
      actorUserId: user?.id ?? null,
    });
  }

  const { count } = await admin
    .from("blog_likes")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);

  return { liked, count: count ?? 0 };
}
