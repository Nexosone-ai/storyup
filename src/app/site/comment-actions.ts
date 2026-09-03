"use server";

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * 공개 블로그 글의 방문자 댓글 액션.
 * blog_comments에는 쓰기 RLS가 없어 모든 쓰기는 여기서 검증 후
 * 관리자 클라이언트로 수행한다. 문구는 사이트 언어(lang)를 따른다.
 */

export interface CommentState {
  error?: string;
  ok?: boolean;
}

function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

function verifyPassword(pw: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pw, Buffer.from(saltHex, "hex"), 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createBlogCommentAction(
  postId: string,
  input: { name: string; password: string; content: string },
  lang: "ko" | "en" = "ko",
): Promise<CommentState> {
  const ko = lang === "ko";
  const content = input.content.trim();
  if (!content)
    return { error: ko ? "댓글 내용을 입력해주세요." : "Please write a comment." };
  if (content.length > 600)
    return {
      error: ko
        ? "600자 이내로 작성해주세요."
        : "Please keep it under 600 characters.",
    };
  const name = input.name.trim().slice(0, 30);

  // 로그인한 STORYUP 사용자는 계정으로, 방문자는 비밀번호로 댓글을 관리한다.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const password = input.password.trim();
  if (!user) {
    if (!name)
      return { error: ko ? "이름을 입력해주세요." : "Please enter your name." };
    if (password.length < 4)
      return {
        error: ko
          ? "삭제할 때 쓸 비밀번호를 4자 이상 입력해주세요."
          : "Please set a password of 4+ characters (used to delete the comment).",
      };
  }

  const admin = createAdminClient();
  let authorName = name;
  if (user) {
    const { data: profile } = await admin
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();
    authorName = profile?.name || name || (ko ? "익명" : "Anonymous");
  }
  const { data: post } = await admin
    .from("blog_posts")
    .select("id, business_id, status")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.status !== "published")
    return { error: ko ? "글을 찾을 수 없습니다." : "Post not found." };

  const { error } = await admin.from("blog_comments").insert({
    post_id: post.id,
    business_id: post.business_id,
    user_id: user?.id ?? null,
    author_name: authorName,
    password_hash: user ? null : hashPassword(password),
    content,
  });
  if (error)
    return {
      error: ko ? "댓글 등록에 실패했습니다." : "Failed to post the comment.",
    };
  return { ok: true };
}

export async function deleteBlogCommentAction(
  commentId: string,
  password: string,
  lang: "ko" | "en" = "ko",
): Promise<CommentState> {
  const ko = lang === "ko";
  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("blog_comments")
    .select("id, user_id, password_hash, business_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment)
    return { error: ko ? "댓글을 찾을 수 없습니다." : "Comment not found." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let allowed = false;
  if (user) {
    if (comment.user_id === user.id) allowed = true;
    else {
      // 글 주인(사이트 소유자)은 자기 글의 모든 댓글을 관리할 수 있다.
      const { data: biz } = await admin
        .from("businesses")
        .select("user_id")
        .eq("id", comment.business_id)
        .maybeSingle();
      if (biz?.user_id === user.id) allowed = true;
    }
  }
  if (!allowed && comment.password_hash && password)
    allowed = verifyPassword(password.trim(), comment.password_hash);
  if (!allowed)
    return {
      error: ko ? "비밀번호가 일치하지 않습니다." : "Wrong password.",
    };

  const { error } = await admin
    .from("blog_comments")
    .delete()
    .eq("id", commentId);
  if (error)
    return { error: ko ? "삭제에 실패했습니다." : "Failed to delete." };
  return { ok: true };
}
