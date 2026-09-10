"use client";

import { useState, useTransition } from "react";
import { toggleBlogLikeAction } from "@/app/site/like-actions";

/** 공개 블로그 글의 좋아요 버튼 — 하트 + 카운트, 낙관적 토글. */
export function BlogLikeButton({
  postId,
  initialLiked,
  initialCount,
  lang,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  lang: "ko" | "en";
}) {
  const ko = lang === "ko";
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();

  const toggle = () => {
    // 낙관적 업데이트 — 서버 응답으로 정확한 값을 다시 맞춘다.
    const next = !liked;
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    start(async () => {
      const res = await toggleBlogLikeAction(postId);
      if (!res.error) {
        setLiked(res.liked);
        setCount(res.count);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={liked}
      aria-label={ko ? "좋아요" : "Like"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        liked
          ? "border-primary/40 bg-primary-soft text-primary"
          : "border-border text-muted hover:border-primary/40 hover:text-primary"
      }`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l1.7 1.7L12 21.5l7.1-7.1 1.7-1.7a5 5 0 0 0 0-7.1Z" />
      </svg>
      <span className="tnum">{count}</span>
    </button>
  );
}
