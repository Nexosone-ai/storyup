"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { InstagramCard, toIGCards, cardImageSubject } from "./InstagramCard";
import { IG } from "./cardTheme";
import { resizeImage } from "@/components/website/templates/ImageSlot";
import { trackEvent } from "@/lib/track";
import type { CardNewsResult } from "@/types/domain";

interface PostOption {
  id: string;
  title: string;
  slug?: string;
  published?: boolean;
}

const PREVIEW_W = 264;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

async function downloadNode(node: HTMLElement | null, filename: string) {
  if (!node) return;
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(node, { pixelRatio: 1, cacheBust: true });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function CardNewsStudio({
  businessId,
  posts,
  brandName,
  handle,
  siteSlug,
  initial,
}: {
  businessId: string;
  posts: PostOption[];
  brandName: string;
  handle: string;
  /** 공개된 홈페이지 슬러그 — 없으면 공유 링크 대신 안내를 보여준다. */
  siteSlug?: string | null;
  initial?: { cardNews?: CardNewsResult; blogPostId?: string };
}) {
  const [postId, setPostId] = useState(
    initial?.blogPostId ?? posts[0]?.id ?? "",
  );
  const [data, setData] = useState<CardNewsResult | null>(
    initial?.cardNews ?? null,
  );
  const [images, setImages] = useState<Array<string | undefined>>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgProgress, setImgProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const igRefs = useRef<Array<HTMLDivElement | null>>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const uploadTarget = useRef(0);

  const cards = useMemo(() => (data ? toIGCards(data) : []), [data]);
  const igScale = PREVIEW_W / IG.w;
  const slugName = () => handle.replace(/^@/, "") || "storyup";

  const generate = async () => {
    if (!postId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/card-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, blogPostId: postId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "생성에 실패했습니다.");
      setData(json.cardNews as CardNewsResult);
      setImages([]); // reset backdrops for the new set
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const generateImages = async () => {
    if (!cards.length) return;
    setError(null);
    setImgBusy(true);
    setImgProgress(0);
    try {
      const results = await Promise.all(
        cards.map(async (card) => {
          try {
            const res = await fetch("/api/ai/card-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                businessId,
                subject: cardImageSubject(card),
                aspect: "3:4",
              }),
            });
            const json = await res.json();
            setImgProgress((p) => p + 1);
            if (!res.ok) throw new Error(json.error ?? "이미지 생성 실패");
            return json.image as string;
          } catch (e) {
            if (e instanceof Error && /키|API|401|502/.test(e.message)) {
              throw e; // surface config errors
            }
            setImgProgress((p) => p + 1);
            return undefined;
          }
        }),
      );
      setImages(results);
      if (results.every((r) => !r))
        setError("이미지를 생성하지 못했습니다. API 키 설정을 확인해주세요.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지 생성에 실패했습니다.");
    } finally {
      setImgBusy(false);
    }
  };

  const pickImage = (i: number) => {
    uploadTarget.current = i;
    fileRef.current?.click();
  };

  const onUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      // 카드 원본(1080px)에 맞춰 축소 후 data URL로 보관 — 내보내기(html-to-image)와 호환.
      const dataUrl = await fileToDataUrl(await resizeImage(file, 1080));
      const i = uploadTarget.current;
      setImages((prev) => {
        const next = [...prev];
        next[i] = dataUrl;
        return next;
      });
    } catch {
      setError("이미지를 불러오지 못했습니다. 다른 파일로 시도해주세요.");
    }
  };

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      setError("이미지 저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const downloadAll = () =>
    withBusy(async () => {
      for (let i = 0; i < igRefs.current.length; i++) {
        await downloadNode(
          igRefs.current[i],
          `${slugName()}-card-${String(i + 1).padStart(2, "0")}.png`,
        );
        await new Promise((r) => setTimeout(r, 350));
      }
    });

  // 공유 대상: 선택한 글이 공개됐으면 그 글, 아니면 공개된 홈페이지.
  const selectedPost = posts.find((p) => p.id === postId);
  const sharePath = !siteSlug
    ? null
    : selectedPost?.published && selectedPost.slug
      ? `/site/${siteSlug}/blog/${selectedPost.slug}`
      : `/site/${siteSlug}`;

  const openShare = (channel: "x" | "facebook") => {
    if (!sharePath || !data) return;
    trackEvent({ slug: siteSlug!, event: "share", path: sharePath, channel });
    const url = `${window.location.origin}${sharePath}`;
    const target =
      channel === "x"
        ? (() => {
            const u = new URL("https://twitter.com/intent/tweet");
            u.searchParams.set("url", url);
            u.searchParams.set("text", data.cover.title);
            return u.toString();
          })()
        : (() => {
            const u = new URL("https://www.facebook.com/sharer/sharer.php");
            u.searchParams.set("u", url);
            return u.toString();
          })();
    window.open(target, "_blank", "noopener,width=600,height=500");
  };

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
        <p className="text-muted">
          먼저 블로그 글을 작성하면 카드뉴스로 만들어드립니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onUploadFile}
      />
      <Card className="space-y-4">
        <div>
          <Label htmlFor="cn-post">블로그 글 선택</Label>
          <Select
            id="cn-post"
            value={postId}
            onChange={(e) => setPostId(e.target.value)}
          >
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={loading || imgBusy}>
            {loading ? <Spinner /> : <Icon.sparkles className="size-[18px]" />}
            {data ? "카드 다시 생성" : "카드뉴스 생성"}
          </Button>
          {data && (
            <Button
              variant="outline"
              onClick={generateImages}
              disabled={imgBusy || loading}
            >
              {imgBusy ? (
                <>
                  <Spinner className="size-4" />
                  이미지 생성 중 {imgProgress}/{cards.length}
                </>
              ) : (
                <>
                  <Icon.sparkles className="size-4" />
                  {images.some(Boolean) ? "AI 이미지 다시 생성" : "AI 이미지 생성"}
                </>
              )}
            </Button>
          )}
          {images.some(Boolean) && !imgBusy && (
            <Button variant="ghost" onClick={() => setImages([])}>
              이미지 지우기
            </Button>
          )}
        </div>
      </Card>

      {data && (
        <>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted">
                인스타그램 카드 {cards.length}장
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={downloadAll} disabled={busy}>
                  {busy ? (
                    <Spinner className="size-4" />
                  ) : (
                    <Icon.external className="size-4" />
                  )}
                  전체 PNG 저장
                </Button>
                {sharePath ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openShare("x")}
                      aria-label="X에 공유"
                      title="X에 공유"
                      className="grid size-8 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      <Icon.xBrand width={15} height={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openShare("facebook")}
                      aria-label="Facebook에 공유"
                      title="Facebook에 공유"
                      className="grid size-8 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      <Icon.facebookBrand width={16} height={16} />
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-muted">
                    홈페이지를 공개하면 X·Facebook으로 바로 공유할 수 있어요.
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto rounded-2xl border border-border bg-surface-muted/40 p-4">
              {cards.map((card, i) => (
                <div key={i} className="shrink-0">
                  <div
                    className="overflow-hidden rounded-xl border border-border shadow-sm"
                    style={{ width: PREVIEW_W, height: IG.h * igScale }}
                  >
                    <div
                      style={{
                        width: IG.w,
                        height: IG.h,
                        transform: `scale(${igScale})`,
                        transformOrigin: "top left",
                      }}
                    >
                      <InstagramCard
                        card={card}
                        pageNo={i + 1}
                        total={cards.length}
                        brandName={brandName}
                        handle={handle}
                        image={images[i]}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <button
                      onClick={() => pickImage(i)}
                      disabled={busy || imgBusy}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                    >
                      사진 올리기
                    </button>
                    <button
                      onClick={() =>
                        withBusy(() =>
                          downloadNode(
                            igRefs.current[i],
                            `${slugName()}-card-${String(i + 1).padStart(2, "0")}.png`,
                          ),
                        )
                      }
                      disabled={busy}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                    >
                      {i + 1}번 저장
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">
              PNG는 실제 크기(1080×1350)로 저장됩니다. AI 이미지 또는 직접
              올린 사진이 각 카드의 배경으로 들어갑니다.
            </p>
          </div>

          {/* Hidden full-size export layer */}
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: -99999,
              top: 0,
              pointerEvents: "none",
            }}
          >
            {cards.map((card, i) => (
              <InstagramCard
                key={i}
                ref={(el) => {
                  igRefs.current[i] = el;
                }}
                card={card}
                pageNo={i + 1}
                total={cards.length}
                brandName={brandName}
                handle={handle}
                image={images[i]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
