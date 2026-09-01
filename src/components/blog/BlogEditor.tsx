"use client";

import { useRef, useState, useTransition, useMemo } from "react";
import { marked } from "marked";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";
import {
  saveBlogAction,
  publishBlogAction,
  updateBlogCoverAction,
  uploadSiteImage,
} from "@/app/business/actions";
import { preprocessMarkdown } from "@/utils/markdown";
import { BlogCover } from "@/components/blog/BlogCover";
import { resizeImage } from "@/components/website/templates/ImageSlot";
import type { BlogPostRow } from "@/types/database";

marked.setOptions({ gfm: true, breaks: true });

type Tab = "write" | "preview";

export function BlogEditor({
  businessId,
  post,
  siteSlug,
  sitePublished,
}: {
  businessId: string;
  post: BlogPostRow;
  siteSlug: string | null;
  sitePublished: boolean;
}) {
  const [title, setTitle] = useState(post.title);
  const [summary, setSummary] = useState(post.summary ?? "");
  const [content, setContent] = useState(post.content ?? "");
  const [status, setStatus] = useState(post.status);
  const [cover, setCover] = useState(post.cover_image_url ?? null);
  const [tab, setTab] = useState<Tab>("write");
  const [note, setNote] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [coverPending, startCover] = useTransition();
  const [mediaBusy, setMediaBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const bodyImageRef = useRef<HTMLInputElement>(null);

  const previewHtml = useMemo(
    () =>
      marked.parse(preprocessMarkdown(content || "_내용을 입력하세요._")) as string,
    [content],
  );

  const generateCover = () =>
    startCover(async () => {
      setNote(null);
      try {
        const res = await fetch("/api/ai/blog-cover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId, postId: post.id }),
        });
        const json = await res.json();
        if (!res.ok || !json.url) {
          setNote(json.error ?? "이미지 생성에 실패했습니다.");
          return;
        }
        setCover(json.url);
        setNote("커버 이미지가 생성되었습니다.");
      } catch {
        setNote("이미지 생성에 실패했습니다. 다시 시도해주세요.");
      }
    });

  const uploadCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    startCover(async () => {
      setNote(null);
      try {
        const resized = await resizeImage(file, 1920);
        const fd = new FormData();
        fd.append("file", resized);
        const up = await uploadSiteImage(businessId, fd);
        if (up.error || !up.url) {
          setNote(up.error ?? "업로드에 실패했습니다.");
          return;
        }
        const res = await updateBlogCoverAction(businessId, post.id, up.url);
        if (res.error) setNote(res.error);
        else {
          setCover(up.url);
          setNote(res.message ?? "커버 이미지가 저장되었습니다.");
        }
      } catch {
        setNote("업로드 중 문제가 발생했습니다.");
      }
    });
  };

  const clearCover = () =>
    startCover(async () => {
      setNote(null);
      const res = await updateBlogCoverAction(businessId, post.id, null);
      if (res.error) setNote(res.error);
      else {
        setCover(null);
        setNote(res.message ?? null);
      }
    });

  const wrap = (before: string, after = "") => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = content.slice(s, e);
    const next = content.slice(0, s) + before + sel + after + content.slice(e);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = s + before.length;
      el.selectionEnd = e + before.length;
    });
  };

  /** 본문 커서 위치에 텍스트 블록을 삽입한다 (앞뒤 개행 보장). */
  const insertBlock = (block: string) => {
    setTab("write");
    wrap(`\n${block}\n`);
  };

  const insertBodyImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void (async () => {
      setMediaBusy(true);
      setNote(null);
      try {
        const resized = await resizeImage(file, 1600);
        const fd = new FormData();
        fd.append("file", resized);
        const up = await uploadSiteImage(businessId, fd);
        if (up.error || !up.url) setNote(up.error ?? "업로드에 실패했습니다.");
        else insertBlock(`![사진](${up.url})`);
      } catch {
        setNote("업로드 중 문제가 발생했습니다.");
      } finally {
        setMediaBusy(false);
      }
    })();
  };

  const insertVideo = () => {
    const url = window.prompt(
      "삽입할 영상 링크를 붙여넣으세요 (YouTube 링크는 본문에서 바로 재생됩니다):",
    );
    if (!url?.trim()) return;
    insertBlock(url.trim());
  };

  const save = () =>
    startSave(async () => {
      setNote(null);
      const res = await saveBlogAction(businessId, post.id, {
        title,
        content,
        summary,
      });
      setNote(res.error ?? "저장되었습니다.");
    });

  const togglePublish = () =>
    startPublish(async () => {
      setNote(null);
      const next = status !== "published";
      await saveBlogAction(businessId, post.id, { title, content, summary });
      const res = await publishBlogAction(businessId, post.id, next);
      if (res.error) setNote(res.error);
      else {
        setStatus(next ? "published" : "draft");
        setNote(res.message ?? null);
      }
    });

  const publicHref =
    sitePublished && siteSlug
      ? `/site/${siteSlug}/blog/${post.slug}`
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ButtonLink
            href={`/business/${businessId}/blog`}
            variant="ghost"
            size="sm"
          >
            <Icon.arrowLeft width={16} height={16} />
            목록
          </ButtonLink>
          {status === "published" ? (
            <Badge tone="success">공개됨</Badge>
          ) : (
            <Badge tone="muted">초안</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {publicHref && (
            <ButtonLink href={publicHref} variant="outline" size="sm">
              <Icon.external width={16} height={16} />
              보기
            </ButtonLink>
          )}
          <Button variant="outline" size="sm" onClick={save} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : "저장"}
          </Button>
          <Button size="sm" onClick={togglePublish} disabled={publishing}>
            {publishing ? (
              <Spinner className="h-4 w-4" />
            ) : status === "published" ? (
              "비공개로 전환"
            ) : (
              "게시하기"
            )}
          </Button>
        </div>
      </div>

      {note && <p className="text-sm text-primary">{note}</p>}
      {status === "published" && !sitePublished && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-warning">
          홈페이지가 아직 공개되지 않아 블로그가 외부에 보이지 않습니다.
          홈페이지를 먼저 공개해주세요.
        </p>
      )}

      <div>
        <Label htmlFor="title">제목</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-semibold"
        />
      </div>
      <div>
        <Label htmlFor="summary">요약</Label>
        <Input
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      {/* Cover image */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <Label>커버 이미지</Label>
          <div className="flex flex-wrap gap-2">
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={uploadCover}
            />
            {cover && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCover}
                disabled={coverPending}
              >
                기본 커버로
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => coverFileRef.current?.click()}
              disabled={coverPending}
            >
              {coverPending ? <Spinner className="h-4 w-4" /> : "이미지 업로드"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={generateCover}
              disabled={coverPending}
            >
              {coverPending ? (
                <>
                  <Spinner className="h-4 w-4" />
                  처리 중...
                </>
              ) : cover ? (
                "AI로 다시 생성"
              ) : (
                "AI 커버 이미지 생성"
              )}
            </Button>
          </div>
        </div>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- 원격 스토리지 URL, 크기 고정 컨테이너
          <img
            src={cover}
            alt="커버 이미지"
            className="aspect-[16/7] w-full rounded-xl object-cover"
          />
        ) : (
          <BlogCover
            title={title}
            seed={post.slug}
            showTitle={false}
            className="aspect-[16/7] w-full rounded-xl"
          />
        )}
      </div>

      {/* Content editor */}
      <div className="rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <input
            ref={bodyImageRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={insertBodyImage}
          />
          <div className="flex gap-1">
            <ToolbarBtn onClick={() => wrap("## ")}>H</ToolbarBtn>
            <ToolbarBtn onClick={() => wrap("**", "**")}>B</ToolbarBtn>
            <ToolbarBtn onClick={() => wrap("- ")}>•</ToolbarBtn>
            <ToolbarBtn
              title="본문에 사진 넣기"
              disabled={mediaBusy}
              onClick={() => bodyImageRef.current?.click()}
            >
              {mediaBusy ? (
                <Spinner className="size-4" />
              ) : (
                <Icon.image width={16} height={16} />
              )}
            </ToolbarBtn>
            <ToolbarBtn title="영상 링크 넣기" onClick={insertVideo}>
              <Icon.video width={16} height={16} />
            </ToolbarBtn>
          </div>
          <div className="flex gap-1 rounded-lg bg-surface-muted p-1">
            {(["write", "preview"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium",
                  tab === t
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted",
                )}
              >
                {t === "write" ? "작성" : "미리보기"}
              </button>
            ))}
          </div>
        </div>

        {tab === "write" ? (
          <textarea
            ref={ref}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[420px] w-full resize-y rounded-b-2xl bg-surface p-4 font-mono text-sm leading-relaxed focus:outline-none"
            placeholder="마크다운으로 작성하세요..."
          />
        ) : (
          <div
            className="prose min-h-[420px] max-w-none p-5"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-md text-sm font-semibold text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
    >
      {children}
    </button>
  );
}
