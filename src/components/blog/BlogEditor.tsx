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
import { useLocale } from "@/components/i18n/LocaleProvider";
import { resizeImage } from "@/components/website/templates/ImageSlot";
import type { BlogPostRow } from "@/types/database";

marked.setOptions({ gfm: true, breaks: true });

type Tab = "write" | "preview";

export function BlogEditor({
  businessId,
  post,
  siteSlug,
  sitePublished,
  categories = [],
}: {
  businessId: string;
  post: BlogPostRow;
  siteSlug: string | null;
  sitePublished: boolean;
  /** 이 비즈니스의 기존 블로그 메뉴 목록 (자동완성용) */
  categories?: string[];
}) {
  const ko = useLocale() === "ko";
  const [title, setTitle] = useState(post.title);
  const [summary, setSummary] = useState(post.summary ?? "");
  const [category, setCategory] = useState(post.category ?? "");
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
      marked.parse(
        preprocessMarkdown(
          content || (ko ? "_내용을 입력하세요._" : "_Write something..._"),
        ),
      ) as string,
    [content, ko],
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
          setNote(
            json.error ??
              (ko ? "이미지 생성에 실패했습니다." : "Image generation failed."),
          );
          return;
        }
        setCover(json.url);
        setNote(ko ? "커버 이미지가 생성되었습니다." : "Cover image created.");
      } catch {
        setNote(
          ko
            ? "이미지 생성에 실패했습니다. 다시 시도해주세요."
            : "Image generation failed. Please try again.",
        );
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
          setNote(up.error ?? (ko ? "업로드에 실패했습니다." : "Upload failed."));
          return;
        }
        const res = await updateBlogCoverAction(businessId, post.id, up.url);
        if (res.error) setNote(res.error);
        else {
          setCover(up.url);
          setNote(
            res.message ??
              (ko ? "커버 이미지가 저장되었습니다." : "Cover image saved."),
          );
        }
      } catch {
        setNote(
          ko
            ? "업로드 중 문제가 발생했습니다."
            : "Something went wrong during upload.",
        );
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
        if (up.error || !up.url)
          setNote(up.error ?? (ko ? "업로드에 실패했습니다." : "Upload failed."));
        else insertBlock(`![사진](${up.url})`);
      } catch {
        setNote(
          ko
            ? "업로드 중 문제가 발생했습니다."
            : "Something went wrong during upload.",
        );
      } finally {
        setMediaBusy(false);
      }
    })();
  };

  const insertVideo = () => {
    const url = window.prompt(
      ko
        ? "삽입할 영상 링크를 붙여넣으세요 (YouTube 링크는 본문에서 바로 재생됩니다):"
        : "Paste a video link to insert (YouTube links play inline in the post):",
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
        category,
      });
      setNote(res.error ?? (ko ? "저장되었습니다." : "Saved."));
    });

  const togglePublish = () =>
    startPublish(async () => {
      setNote(null);
      const next = status !== "published";
      await saveBlogAction(businessId, post.id, {
        title,
        content,
        summary,
        category,
      });
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
            {ko ? "목록" : "Back to list"}
          </ButtonLink>
          {status === "published" ? (
            <Badge tone="success">{ko ? "공개됨" : "Published"}</Badge>
          ) : (
            <Badge tone="muted">{ko ? "초안" : "Draft"}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {publicHref && (
            <ButtonLink href={publicHref} variant="outline" size="sm">
              <Icon.external width={16} height={16} />
              {ko ? "보기" : "View"}
            </ButtonLink>
          )}
          <Button variant="outline" size="sm" onClick={save} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : ko ? "저장" : "Save"}
          </Button>
          <Button size="sm" onClick={togglePublish} disabled={publishing}>
            {publishing ? (
              <Spinner className="h-4 w-4" />
            ) : status === "published" ? (
              ko ? "비공개로 전환" : "Unpublish"
            ) : ko ? (
              "게시하기"
            ) : (
              "Publish"
            )}
          </Button>
        </div>
      </div>

      {note && <p className="text-sm text-primary">{note}</p>}
      {status === "published" && !sitePublished && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-warning">
          {ko
            ? "랜딩페이지가 아직 공개되지 않아 블로그가 외부에 보이지 않습니다. 랜딩페이지를 먼저 공개해주세요."
            : "Your landing page is not published yet, so this blog is not visible to the public. Publish your landing page first."}
        </p>
      )}

      <div>
        <Label htmlFor="title">{ko ? "제목" : "Title"}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-semibold"
        />
      </div>
      <div>
        <Label htmlFor="summary">{ko ? "요약" : "Summary"}</Label>
        <Input
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="category">{ko ? "메뉴" : "Menu"}</Label>
        <Input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="blog-category-options"
          maxLength={30}
          placeholder={
            ko
              ? "예: 소식, 레시피 — 새 이름을 입력하면 메뉴가 추가됩니다"
              : "e.g. News, Recipes — type a new name to add a menu"
          }
        />
        <datalist id="blog-category-options">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-muted">
          {ko
            ? "글이 속할 블로그 메뉴입니다. 비워두면 미분류로 저장됩니다."
            : "The blog menu this post belongs to. Leave empty for uncategorized."}
        </p>
      </div>

      {/* Cover image */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <Label>{ko ? "커버 이미지" : "Cover image"}</Label>
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
                {ko ? "기본 커버로" : "Use default cover"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => coverFileRef.current?.click()}
              disabled={coverPending}
            >
              {coverPending ? (
                <Spinner className="h-4 w-4" />
              ) : ko ? (
                "이미지 업로드"
              ) : (
                "Upload image"
              )}
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
                  {ko ? "처리 중..." : "Working..."}
                </>
              ) : cover ? (
                ko ? "AI로 다시 생성" : "Regenerate with AI"
              ) : ko ? (
                "AI 커버 이미지 생성"
              ) : (
                "Generate AI cover image"
              )}
            </Button>
          </div>
        </div>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- 원격 스토리지 URL, 크기 고정 컨테이너
          <img
            src={cover}
            alt={ko ? "커버 이미지" : "Cover image"}
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
              title={ko ? "본문에 사진 넣기" : "Insert photo into body"}
              disabled={mediaBusy}
              onClick={() => bodyImageRef.current?.click()}
            >
              {mediaBusy ? (
                <Spinner className="size-4" />
              ) : (
                <Icon.image width={16} height={16} />
              )}
            </ToolbarBtn>
            <ToolbarBtn
              title={ko ? "영상 링크 넣기" : "Insert video link"}
              onClick={insertVideo}
            >
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
                {t === "write"
                  ? ko
                    ? "작성"
                    : "Write"
                  : ko
                    ? "미리보기"
                    : "Preview"}
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
            placeholder={
              ko ? "마크다운으로 작성하세요..." : "Write in Markdown..."
            }
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
