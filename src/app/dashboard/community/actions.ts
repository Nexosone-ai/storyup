"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

const PATH = "/dashboard/community";

export async function createStoryPost(content: string): Promise<CommunityState> {
  const body = content.trim();
  if (!body) return { error: "내용을 입력해주세요." };
  if (body.length > 1000) return { error: "1000자 이내로 작성해주세요." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("story_connect_posts").insert({
    user_id: user.id,
    author_name: profile?.name || "익명",
    content: body,
  });
  if (error) return { error: "등록에 실패했습니다." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function createRealTalkPost(
  content: string,
): Promise<CommunityState> {
  const body = content.trim();
  if (!body) return { error: "내용을 입력해주세요." };
  if (body.length > 200) return { error: "200자 이내로 작성해주세요." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("real_talk_posts")
    .insert({ user_id: user.id, content: body });
  if (error) return { error: "등록에 실패했습니다." };
  revalidatePath(PATH);
  return { ok: true };
}

async function toggleLike(
  likesTable: "story_connect_likes" | "real_talk_likes",
  postId: string,
): Promise<CommunityState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };

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

export const toggleStoryLike = (postId: string) =>
  toggleLike("story_connect_likes", postId);
export const toggleRealTalkLike = (postId: string) =>
  toggleLike("real_talk_likes", postId);

async function deletePost(
  table: "story_connect_posts" | "real_talk_posts",
  postId: string,
): Promise<CommunityState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);
  if (error) return { error: "삭제에 실패했습니다." };
  revalidatePath(PATH);
  return { ok: true };
}

export const deleteStoryPost = (postId: string) =>
  deletePost("story_connect_posts", postId);
export const deleteRealTalkPost = (postId: string) =>
  deletePost("real_talk_posts", postId);
