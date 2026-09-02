"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Card";
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
        <p className="text-muted">
          {ko ? "아직 작성한 글이 없습니다." : "No posts yet."}
        </p>
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
