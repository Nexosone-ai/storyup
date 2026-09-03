"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBlogCommentAction,
  deleteBlogCommentAction,
} from "@/app/site/comment-actions";

export interface BlogCommentItem {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
  /** 현재 방문자(로그인 사용자 본인 또는 사이트 주인)가 바로 삭제할 수 있는지 */
  canDelete: boolean;
  /** 비밀번호로 삭제하는 방문자 댓글인지 */
  hasPassword: boolean;
}

function fmtDate(iso: string, ko: boolean): string {
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** 공개 블로그 글 하단의 방문자 댓글 목록 + 작성 폼. */
export function BlogComments({
  postId,
  comments,
  lang,
  loggedIn,
}: {
  postId: string;
  comments: BlogCommentItem[];
  lang: "ko" | "en";
  loggedIn: boolean;
}) {
  const ko = lang === "ko";
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const inputCls =
    "rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none";

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await createBlogCommentAction(
        postId,
        { name, password, content },
        lang,
      );
      if (res.error) setError(res.error);
      else {
        setContent("");
        setPassword("");
        router.refresh();
      }
    });

  const remove = (c: BlogCommentItem) => {
    let pw = "";
    if (c.canDelete) {
      if (!confirm(ko ? "댓글을 삭제할까요?" : "Delete this comment?")) return;
    } else if (c.hasPassword) {
      const answer = prompt(
        ko
          ? "댓글 작성 시 입력한 비밀번호를 입력해주세요."
          : "Enter the password you set when posting.",
      );
      if (!answer) return;
      pw = answer;
    } else return;
    start(async () => {
      setError(null);
      const res = await deleteBlogCommentAction(c.id, pw, lang);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="text-lg font-semibold tracking-tight">
        {ko ? "댓글" : "Comments"}{" "}
        <span className="tnum text-muted">{comments.length}</span>
      </h2>

      <ul className="mt-5 space-y-4">
        {comments.map((c) => (
          <li key={c.id} className="rounded-xl bg-surface-muted/60 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{c.authorName}</p>
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-muted">
                  {fmtDate(c.createdAt, ko)}
                </span>
                {(c.canDelete || c.hasPassword) && (
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    disabled={pending}
                    className="text-xs text-muted underline-offset-2 hover:text-danger hover:underline"
                  >
                    {ko ? "삭제" : "Delete"}
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {c.content}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-2.5 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap gap-2.5">
          {!loggedIn && (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={ko ? "이름" : "Name"}
                maxLength={30}
                className={`${inputCls} w-36`}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={ko ? "비밀번호 (삭제용)" : "Password (to delete)"}
                maxLength={50}
                className={`${inputCls} w-44`}
              />
            </>
          )}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            ko ? "따뜻한 댓글을 남겨주세요 :)" : "Leave a comment :)"
          }
          maxLength={600}
          className={`${inputCls} min-h-20 w-full resize-y`}
        />
        <div className="flex items-center justify-between">
          <span className="tnum text-xs text-muted">{content.length}/600</span>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !content.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending
              ? ko
                ? "등록 중..."
                : "Posting..."
              : ko
                ? "댓글 등록"
                : "Post comment"}
          </button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </section>
  );
}
