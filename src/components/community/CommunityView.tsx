"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";
import type { FeedPost } from "@/lib/community";
import {
  createStoryPost,
  createRealTalkPost,
  toggleStoryLike,
  toggleRealTalkLike,
  deleteStoryPost,
  deleteRealTalkPost,
} from "@/app/dashboard/community/actions";

type Tab = "story" | "realtalk";

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

export function CommunityView({
  story,
  realtalk,
}: {
  story: FeedPost[];
  realtalk: FeedPost[];
}) {
  const [tab, setTab] = useState<Tab>("story");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="eyebrow mb-2">커뮤니티</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          함께 나누는 이야기
        </h1>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        {(
          [
            ["story", "스토리 커넥트"],
            ["realtalk", "찐이야기"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "bg-primary-soft text-primary"
                : "text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "story" ? (
        <Feed
          key="story"
          posts={story}
          showAuthor
          placeholder="오늘 사업에서 있었던 이야기를 들려주세요."
          maxLength={1000}
          onCreate={createStoryPost}
          onLike={toggleStoryLike}
          onDelete={deleteStoryPost}
        />
      ) : (
        <Feed
          key="realtalk"
          posts={realtalk}
          showAuthor={false}
          placeholder="한 줄로, 익명으로 솔직한 이야기를 남겨보세요."
          maxLength={200}
          onCreate={createRealTalkPost}
          onLike={toggleRealTalkLike}
          onDelete={deleteRealTalkPost}
        />
      )}
    </div>
  );
}

function Feed({
  posts,
  showAuthor,
  placeholder,
  maxLength,
  onCreate,
  onLike,
  onDelete,
}: {
  posts: FeedPost[];
  showAuthor: boolean;
  placeholder: string;
  maxLength: number;
  onCreate: (content: string) => Promise<{ error?: string; ok?: boolean }>;
  onLike: (postId: string) => Promise<{ error?: string; ok?: boolean }>;
  onDelete: (postId: string) => Promise<{ error?: string; ok?: boolean }>;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await onCreate(text);
      if (res.error) setError(res.error);
      else {
        setText("");
        router.refresh();
      }
    });

  const like = (id: string) =>
    start(async () => {
      await onLike(id);
      router.refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      if (!confirm("삭제할까요?")) return;
      await onDelete(id);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="min-h-20"
        />
        <div className="flex items-center justify-between">
          <span className="tnum text-xs text-muted">
            {text.length}/{maxLength}
          </span>
          <Button size="sm" onClick={submit} disabled={pending || !text.trim()}>
            {pending ? <Spinner className="size-4" /> : "올리기"}
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">
          첫 이야기를 남겨보세요.
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {showAuthor ? p.authorName || "익명" : "익명"}
                </span>
                <span className="text-xs text-muted">{timeAgo(p.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                {p.content}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => like(p.id)}
                  disabled={pending}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                    p.likedByMe
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border text-muted hover:bg-surface-muted",
                  )}
                >
                  <span>♥</span>
                  <span className="tnum">{p.likeCount}</span>
                </button>
                {p.mine && (
                  <button
                    onClick={() => remove(p.id)}
                    disabled={pending}
                    className="rounded-full p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                    aria-label="삭제"
                  >
                    <Icon.x width={16} height={16} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
