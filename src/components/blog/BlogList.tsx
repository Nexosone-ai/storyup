"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { deleteBlogAction } from "@/app/business/actions";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { BlogPostRow } from "@/types/database";

function timeAgo(iso: string, ko: boolean): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) {
    const m = Math.max(min, 1);
    return ko ? `${m}분 전` : `${m}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) return ko ? `${hr}시간 전` : `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return ko ? `${d}일 전` : `${d}d ago`;
}

export function BlogList({
  businessId,
  posts,
}: {
  businessId: string;
  posts: BlogPostRow[];
}) {
  const router = useRouter();
  const ko = useLocale() === "ko";
  const [pending, start] = useTransition();

  const remove = (id: string) => {
    if (!confirm(ko ? "이 글을 삭제할까요?" : "Delete this post?")) return;
    start(async () => {
      await deleteBlogAction(businessId, id);
      router.refresh();
    });
  };

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
          <Icon.pen width={22} height={22} />
        </div>
        <p className="mt-4 font-semibold">
          {ko ? "아직 글이 없어요" : "No posts yet"}
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
          {ko
            ? "블로그 글은 손님이 내 가게를 검색해서 찾아오게 만드는 가장 좋은 방법이에요. 주제 한 줄만 적으면 AI가 대신 써드립니다."
            : "Blog posts are the best way for customers to find your business through search. Write one line about a topic and AI does the rest."}
        </p>
        <ButtonLink
          href={`/business/${businessId}/blog/new`}
          className="mt-5"
        >
          <Icon.sparkles width={18} height={18} />
          {ko ? "AI로 첫 글 쓰기" : "Write your first post with AI"}
        </ButtonLink>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {posts.map((post) => (
        <li
          key={post.id}
          className="flex items-center justify-between gap-4 p-4 hover:bg-surface-muted/40"
        >
          <Link
            href={`/business/${businessId}/blog/${post.id}`}
            className="min-w-0 flex-1"
          >
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{post.title}</p>
              {post.status === "published" ? (
                <Badge tone="success">{ko ? "공개" : "Published"}</Badge>
              ) : (
                <Badge tone="muted">{ko ? "초안" : "Draft"}</Badge>
              )}
              {post.category && <Badge tone="default">{post.category}</Badge>}
            </div>
            {post.summary && (
              <p className="mt-0.5 truncate text-sm text-muted">
                {post.summary}
              </p>
            )}
            <p className="mt-1 text-xs text-muted">
              {timeAgo(post.updated_at, ko)}
            </p>
          </Link>
          <button
            aria-label={ko ? "삭제" : "Delete"}
            onClick={() => remove(post.id)}
            disabled={pending}
            className="shrink-0 rounded-lg p-2 text-muted hover:bg-red-50 hover:text-danger"
          >
            <Icon.x width={18} height={18} />
          </button>
        </li>
      ))}
    </ul>
  );
}
