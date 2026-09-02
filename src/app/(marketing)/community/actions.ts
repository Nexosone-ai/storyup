"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";

export interface CommunityState {
  error?: string;
  ok?: boolean;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const PATH = "/community";
const IMAGE_BUCKET = "community-images";

/** 커뮤니티 글에 첨부할 사진을 업로드하고 공개 URL을 돌려준다. */
export async function uploadCommunityImage(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const ko = (await getLocale()) === "ko";
  const { user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: ko ? "이미지를 선택해주세요." : "Please choose an image." };
  if (file.size > 10 * 1024 * 1024)
    return {
      error: ko
        ? "이미지는 10MB 이하여야 합니다."
        : "Images must be 10MB or smaller.",
    };

  const admin = createAdminClient();
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.some((b) => b.name === IMAGE_BUCKET)) {
      await admin.storage.createBucket(IMAGE_BUCKET, {
        public: true,
        fileSizeLimit: "10MB",
      });
    }
  } catch {
    // 버킷이 이미 있으면 업로드는 그대로 동작한다.
  }

  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `${user.id}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error } = await admin.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: ko ? "업로드에 실패했습니다." : "Upload failed." };

  const {
    data: { publicUrl },
  } = admin.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return { url: publicUrl };
}

export async function createStoryPost(
  content: string,
  imageUrls: string[] = [],
): Promise<CommunityState> {
  const ko = (await getLocale()) === "ko";
  const body = content.trim();
  if (!body && imageUrls.length === 0)
    return { error: ko ? "내용을 입력해주세요." : "Please write something." };
  if (body.length > 1000)
    return {
      error: ko
        ? "1000자 이내로 작성해주세요."
        : "Please keep it under 1000 characters.",
    };
  if (imageUrls.length > 4)
    return {
      error: ko
        ? "사진은 4장까지 올릴 수 있어요."
        : "You can attach up to 4 photos.",
    };

  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("story_connect_posts").insert({
    user_id: user.id,
    author_name: profile?.name || "익명",
    content: body,
    image_urls: imageUrls.slice(0, 4),
  });
  if (error)
    return { error: ko ? "등록에 실패했습니다." : "Failed to post." };
  revalidatePath(PATH);
  return { ok: true };
}

// ---------------- 댓글 ----------------

export async function createComment(
  postType: "story" | "realtalk",
  postId: string,
  content: string,
): Promise<CommunityState> {
  const ko = (await getLocale()) === "ko";
  const body = content.trim();
  if (!body)
    return { error: ko ? "댓글 내용을 입력해주세요." : "Please write a comment." };
  if (body.length > 500)
    return {
      error: ko
        ? "500자 이내로 작성해주세요."
        : "Please keep it under 500 characters.",
    };

  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  // 찐이야기(realtalk)는 익명 공간이므로 댓글도 익명으로 남긴다.
  let authorName = "익명";
  if (postType === "story") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();
    authorName = profile?.name || "익명";
  }

  const { error } = await supabase.from("community_comments").insert({
    post_type: postType,
    post_id: postId,
    user_id: user.id,
    author_name: authorName,
    content: body,
  });
  if (error)
    return {
      error: ko ? "댓글 등록에 실패했습니다." : "Failed to post the comment.",
    };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteComment(
  commentId: string,
): Promise<CommunityState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  const { error } = await supabase
    .from("community_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);
  if (error)
    return { error: ko ? "삭제에 실패했습니다." : "Failed to delete." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function createRealTalkPost(
  content: string,
): Promise<CommunityState> {
  const ko = (await getLocale()) === "ko";
  const body = content.trim();
  if (!body)
    return { error: ko ? "내용을 입력해주세요." : "Please write something." };
  if (body.length > 200)
    return {
      error: ko
        ? "200자 이내로 작성해주세요."
        : "Please keep it under 200 characters.",
    };

  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };

  const { error } = await supabase
    .from("real_talk_posts")
    .insert({ user_id: user.id, content: body });
  if (error)
    return { error: ko ? "등록에 실패했습니다." : "Failed to post." };
  revalidatePath(PATH);
  return { ok: true };
}

async function toggleLike(
  likesTable: "story_connect_likes" | "real_talk_likes",
  postId: string,
): Promise<CommunityState> {
  const { supabase, user } = await requireUser();
  if (!user)
    return {
      error:
        (await getLocale()) === "ko" ? "로그인이 필요합니다." : "Please log in.",
    };

  const { data: existing } = await supabase
    .from(likesTable)
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from(likesTable).delete().eq("id", existing.id);
  } else {
    await supabase
      .from(likesTable)
      .insert({ post_id: postId, user_id: user.id });
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function toggleStoryLike(postId: string) {
  return toggleLike("story_connect_likes", postId);
}
export async function toggleRealTalkLike(postId: string) {
  return toggleLike("real_talk_likes", postId);
}

async function deletePost(
  table: "story_connect_posts" | "real_talk_posts",
  postId: string,
): Promise<CommunityState> {
  const ko = (await getLocale()) === "ko";
  const { supabase, user } = await requireUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);
  if (error)
    return { error: ko ? "삭제에 실패했습니다." : "Failed to delete." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteStoryPost(postId: string) {
  return deletePost("story_connect_posts", postId);
}
export async function deleteRealTalkPost(postId: string) {
  return deletePost("real_talk_posts", postId);
}
