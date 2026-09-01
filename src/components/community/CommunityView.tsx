"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea, Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";
import { resizeImage } from "@/components/website/templates/ImageSlot";
import type { FeedPost } from "@/lib/community";
import {
  createStoryPost,
  createRealTalkPost,
  toggleStoryLike,
  toggleRealTalkLike,
  deleteStoryPost,
  deleteRealTalkPost,
  uploadCommunityImage,
  createComment,
  deleteComment,
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
          postType="story"
          showAuthor
          allowPhotos
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
          postType="realtalk"
          showAuthor={false}
          placeholder="한 줄로, 익명으로 솔직한 이야기를 남겨보세요."
          maxLength={200}
          onCreate={(content) => createRealTalkPost(content)}
          onLike={toggleRealTalkLike}
          onDelete={deleteRealTalkPost}
        />
      )}
    </div>
  );
}

function Feed({
  posts,
  postType,
  showAuthor,
  allowPhotos = false,
  placeholder,
  maxLength,
  onCreate,
  onLike,
  onDelete,
}: {
  posts: FeedPost[];
  postType: Tab;
  showAuthor: boolean;
  allowPhotos?: boolean;
  placeholder: string;
  maxLength: number;
  onCreate: (
    content: string,
    imageUrls?: string[],
  ) => Promise<{ error?: string; ok?: boolean }>;
  onLike: (postId: string) => Promise<{ error?: string; ok?: boolean }>;
  onDelete: (postId: string) => Promise<{ error?: string; ok?: boolean }>;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setError(null);
    setUploading(true);
    const added: string[] = [];
    for (const file of files.slice(0, 4 - images.length)) {
      try {
        const resized = await resizeImage(file, 1400);
        const fd = new FormData();
        fd.append("file", resized);
        const res = await uploadCommunityImage(fd);
        if (res.url) added.push(res.url);
        else setError(res.error ?? "일부 사진을 올리지 못했습니다.");
      } catch {
        setError("사진 업로드 중 문제가 발생했습니다.");
      }
    }
    if (added.length) setImages((prev) => [...prev, ...added].slice(0, 4));
    setUploading(false);
  };

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await onCreate(text, images);
      if (res.error) setError(res.error);
      else {
        setText("");
        setImages([]);
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
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div
                key={i}
                className="relative size-20 overflow-hidden rounded-lg border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 방금 업로드한 원격 이미지 */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() =>
                    setImages((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-[11px] text-white hover:bg-black/80"
                  aria-label="사진 제거"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {allowPhotos && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onFiles}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || images.length >= 4}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                >
                  {uploading ? (
                    <Spinner className="size-4" />
                  ) : (
                    <Icon.camera width={17} height={17} />
                  )}
                  사진 {images.length > 0 && `${images.length}/4`}
                </button>
              </>
            )}
            <span className="tnum text-xs text-muted">
              {text.length}/{maxLength}
            </span>
          </div>
          <Button
            size="sm"
            onClick={submit}
            disabled={pending || uploading || (!text.trim() && images.length === 0)}
          >
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
              {p.content && (
                <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                  {p.content}
                </p>
              )}
              {p.imageUrls.length > 0 && (
                <div
                  className={cn(
                    "mt-3 grid gap-2",
                    p.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2",
                  )}
                >
                  {p.imageUrls.map((src, i) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "overflow-hidden rounded-xl border border-border",
                        p.imageUrls.length === 1
                          ? "max-h-96"
                          : "aspect-square",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 원격 이미지 */}
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover transition-opacity hover:opacity-90"
                      />
                    </a>
                  ))}
                </div>
              )}
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
              <CommentSection post={p} postType={postType} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentSection({ post, postType }: { post: FeedPost; postType: Tab }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await createComment(postType, post.id, text);
      if (res.error) setError(res.error);
      else {
        setText("");
        router.refresh();
      }
    });

  const remove = (commentId: string) =>
    start(async () => {
      if (!confirm("댓글을 삭제할까요?")) return;
      await deleteComment(commentId);
      router.refresh();
    });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <Icon.chat width={15} height={15} />
        댓글 <span className="tnum">{post.comments.length}</span>
        <span className="text-xs">{open ? "접기" : "보기"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {post.comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-surface-muted/60 px-3.5 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{c.authorName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted">
                    {timeAgo(c.createdAt)}
                  </span>
                  {c.mine && (
                    <button
                      onClick={() => remove(c.id)}
                      disabled={pending}
                      className="text-muted hover:text-danger"
                      aria-label="댓글 삭제"
                    >
                      <Icon.x width={13} height={13} />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {c.content}
              </p>
            </div>
          ))}

          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (text.trim() && !pending) submit();
                }
              }}
              placeholder="댓글을 남겨보세요"
              maxLength={500}
              className="h-9 text-sm"
            />
            <Button
              size="sm"
              onClick={submit}
              disabled={pending || !text.trim()}
            >
              {pending ? <Spinner className="size-4" /> : "등록"}
            </Button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
