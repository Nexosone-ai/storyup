"use client";

import { useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { GuideSteps, CopyButton } from "@/components/ui/GuideCard";
import { InstagramCard, toIGCards, cardImageSubject } from "./InstagramCard";
import {
  uploadSiteImage,
  saveCardImagesAction,
} from "@/app/business/actions";
import { IG } from "./cardTheme";
import { resizeImage } from "@/components/website/templates/ImageSlot";
import { trackEvent } from "@/lib/track";
import { recordShareAction } from "@/app/dashboard/growth/actions";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { CardNewsResult } from "@/types/domain";

interface PostOption {
  id: string;
  title: string;
  slug?: string;
  published?: boolean;
  /** 블로그 생성 시 함께 만들어진 SNS 캡션 (구 글은 없을 수 있음) */
  socialCaption?: string | null;
}

const PREVIEW_W = 264;

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
  /** 공개된 랜딩페이지 슬러그 — 없으면 공유 링크 대신 안내를 보여준다. */
  siteSlug?: string | null;
  initial?: { cardNews?: CardNewsResult; blogPostId?: string };
}) {
  const ko = useLocale() === "ko";
  const [postId, setPostId] = useState(
    initial?.blogPostId ?? posts[0]?.id ?? "",
  );
  const [data, setData] = useState<CardNewsResult | null>(
    initial?.cardNews ?? null,
  );
  // 지난번에 저장해 둔 카드별 배경을 복원한다.
  const [images, setImages] = useState<Array<string | undefined>>(
    initial?.cardNews?.images?.map((u) => u ?? undefined) ?? [],
  );
  // 현재 카드 세트가 어느 블로그 글의 것인지 — 배경 저장 시 필요하다.
  const [dataPostId, setDataPostId] = useState<string | null>(
    initial?.blogPostId ?? null,
  );
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
      if (!res.ok)
        throw new Error(
          json.error ?? (ko ? "생성에 실패했습니다." : "Generation failed."),
        );
      setData(json.cardNews as CardNewsResult);
      setImages([]); // reset backdrops for the new set
      setDataPostId(postId);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : ko
            ? "생성에 실패했습니다."
            : "Generation failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  /** 배경 이미지 목록을 카드뉴스에 저장한다 (URL만 — 실패는 조용히 무시). */
  const persistImages = (arr: Array<string | undefined>) => {
    if (!dataPostId) return;
    void saveCardImagesAction(
      businessId,
      dataPostId,
      arr.map((u) => (u && /^https?:\/\//.test(u) ? u : null)),
    ).catch(() => undefined);
  };

  const generateImages = async () => {
    if (!cards.length) return;
    setError(null);
    setImgBusy(true);
    setImgProgress(0);
    // 순차 생성 — 동시에 여러 장을 요청하면 이미지 서버 제한으로 일부만 성공한다.
    const results: Array<string | undefined> = [];
    let fatal: string | null = null;
    for (const card of cards) {
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
        const json = await res.json().catch(() => ({}) as { error?: string });
        if (!res.ok) {
          const msg =
            json.error ?? (ko ? "이미지 생성 실패" : "Image generation failed");
          // 로그인·포인트 문제는 나머지 카드도 똑같이 실패하므로 즉시 중단한다.
          if (res.status === 401 || res.status === 402) {
            fatal = msg;
            break;
          }
          results.push(undefined);
        } else {
          results.push(json.image as string);
        }
      } catch {
        results.push(undefined);
      }
      setImgProgress((p) => p + 1);
    }
    setImages(results);
    persistImages(results);
    if (fatal) setError(fatal);
    else if (results.every((r) => !r))
      setError(
        ko
          ? "이미지를 생성하지 못했습니다. 잠시 후 다시 시도해주세요."
          : "Could not generate images. Please try again shortly.",
      );
    setImgBusy(false);
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
      // 카드 원본(1080px)에 맞춰 축소 후 스토리지에 올린다 — URL이어야 카드뉴스에 저장된다.
      const resized = await resizeImage(file, 1080);
      const fd = new FormData();
      fd.append("file", resized);
      const up = await uploadSiteImage(businessId, fd);
      if (up.error || !up.url) {
        setError(up.error ?? (ko ? "업로드에 실패했습니다." : "Upload failed."));
        return;
      }
      const next = [...images];
      next[uploadTarget.current] = up.url;
      setImages(next);
      persistImages(next);
    } catch {
      setError(
        ko
          ? "이미지를 불러오지 못했습니다. 다른 파일로 시도해주세요."
          : "Could not load the image. Please try another file.",
      );
    }
  };

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      setError(
        ko
          ? "이미지 저장에 실패했습니다. 다시 시도해주세요."
          : "Could not save the image. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  // 배경(AI 이미지·직접 올린 사진)이 비어 있는 카드 수 — 2번째부터 사진이
  // 빠진 채 올라가는 실수를 막기 위해 저장 전에 확인한다.
  const missingCount = cards.filter((_, i) => !images[i]).length;

  const downloadAll = () => {
    if (
      missingCount > 0 &&
      !confirm(
        ko
          ? `배경 사진이 없는 카드가 ${missingCount}장 있어요.\n'AI 이미지로 배경 채우기'를 누르거나 카드마다 '사진 올리기'로 채우는 걸 추천해요.\n\n그래도 지금 그대로 다운로드할까요?`
          : `${missingCount} card(s) have no background image.\nWe recommend pressing 'Fill backgrounds with AI' or uploading a photo per card first.\n\nDownload as-is anyway?`,
      )
    )
      return;
    void withBusy(async () => {
      for (let i = 0; i < igRefs.current.length; i++) {
        await downloadNode(
          igRefs.current[i],
          `${slugName()}-card-${String(i + 1).padStart(2, "0")}.png`,
        );
        await new Promise((r) => setTimeout(r, 350));
      }
    });
  };

  // 공유 대상: 선택한 글이 공개됐으면 그 글, 아니면 공개된 랜딩페이지.
  const selectedPost = posts.find((p) => p.id === postId);
  const sharePath = !siteSlug
    ? null
    : selectedPost?.published && selectedPost.slug
      ? `/site/${siteSlug}/blog/${selectedPost.slug}`
      : `/site/${siteSlug}`;

  const openShare = (channel: "x" | "facebook") => {
    if (!sharePath || !data) return;
    trackEvent({ slug: siteSlug!, event: "share", path: sharePath, channel });
    // 성장 보상 — 서버에서 본인 확인 후 기록 (실패 무시)
    void recordShareAction(channel);
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
          {ko
            ? "먼저 블로그 글을 작성하면 카드뉴스로 만들어드립니다."
            : "Write a blog post first and we will turn it into card news."}
        </p>
        <ButtonLink
          href={`/business/${businessId}/blog/new`}
          variant="outline"
          className="mt-5"
        >
          <Icon.pen width={16} height={16} />
          {ko ? "블로그 글 쓰러 가기" : "Go write a blog post"}
        </ButtonLink>
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
          <Label htmlFor="cn-post">
            {ko ? "블로그 글 선택" : "Choose a blog post"}
          </Label>
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
        <div data-tour="card-actions" className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={loading || imgBusy}>
            {loading ? <Spinner /> : <Icon.sparkles className="size-[18px]" />}
            {data
              ? ko
                ? "카드 다시 생성"
                : "Regenerate cards"
              : ko
                ? "카드뉴스 생성"
                : "Generate card news"}
          </Button>
        </div>
      </Card>

      {data && (
        <>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted">
                {ko
                  ? `인스타그램 카드 ${cards.length}장`
                  : `${cards.length} Instagram cards`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {images.some(Boolean) && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateImages}
                      disabled={imgBusy || loading}
                    >
                      {imgBusy ? (
                        <>
                          <Spinner className="size-4" />
                          {imgProgress}/{cards.length}
                        </>
                      ) : (
                        <>
                          <Icon.sparkles className="size-4" />
                          {ko ? "AI 이미지 다시 생성" : "Regenerate AI images"}
                        </>
                      )}
                    </Button>
                    {!imgBusy && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setImages([]);
                          persistImages([]);
                        }}
                      >
                        {ko ? "이미지 지우기" : "Clear images"}
                      </Button>
                    )}
                  </>
                )}
                <Button size="sm" onClick={downloadAll} disabled={busy}>
                  {busy ? (
                    <Spinner className="size-4" />
                  ) : (
                    <Icon.external className="size-4" />
                  )}
                  {ko ? "전체 PNG 다운로드" : "Download all PNGs"}
                </Button>
                {sharePath ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openShare("x")}
                      aria-label={ko ? "X에 공유" : "Share on X"}
                      title={ko ? "X에 공유" : "Share on X"}
                      className="grid size-8 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      <Icon.xBrand width={15} height={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openShare("facebook")}
                      aria-label={ko ? "Facebook에 공유" : "Share on Facebook"}
                      title={ko ? "Facebook에 공유" : "Share on Facebook"}
                      className="grid size-8 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      <Icon.facebookBrand width={16} height={16} />
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-muted">
                    {ko
                      ? "랜딩페이지를 공개하면 X·Facebook으로 바로 공유할 수 있어요."
                      : "Publish your landing page to share straight to X and Facebook."}
                  </span>
                )}
              </div>
            </div>

            {missingCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3">
                <p className="text-sm text-warning">
                  {ko
                    ? `배경이 비어 있는 카드가 ${missingCount}장 있어요. AI로 한 번에 채우거나, 각 카드의 '사진 올리기'로 내 사진을 넣어보세요.`
                    : `${missingCount} card(s) have an empty background. Fill them all with AI, or upload your own photo per card.`}
                </p>
                <Button
                  size="sm"
                  onClick={generateImages}
                  disabled={imgBusy || loading}
                >
                  {imgBusy ? (
                    <>
                      <Spinner className="size-4" />
                      {ko ? "생성 중" : "Generating"} {imgProgress}/
                      {cards.length}
                    </>
                  ) : (
                    <>
                      <Icon.sparkles className="size-4" />
                      {ko ? "AI 이미지로 배경 채우기" : "Fill backgrounds with AI"}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* 배경이 다 채워지면 다음 단계(저장 → 인스타 업로드)를 바로 안내한다 */}
            {missingCount === 0 && images.some(Boolean) && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-soft/50 px-4 py-3">
                <p className="text-sm text-foreground/85">
                  {ko
                    ? "배경이 모두 채워졌고 카드뉴스에 자동 저장됐어요! 이제 PNG로 내려받아 인스타그램에 올려보세요."
                    : "All backgrounds are filled and saved to your card news! Now download the PNGs and post them to Instagram."}
                </p>
                <Button size="sm" onClick={downloadAll} disabled={busy}>
                  {busy ? (
                    <Spinner className="size-4" />
                  ) : (
                    <Icon.external className="size-4" />
                  )}
                  {ko ? "전체 PNG 다운로드" : "Download all PNGs"}
                </Button>
              </div>
            )}

            <div className="flex gap-4 overflow-x-auto rounded-2xl border border-border bg-surface-muted/40 p-4">
              {cards.map((card, i) => (
                <div key={i} className="shrink-0">
                  <div className="mb-2 flex gap-1.5">
                    <button
                      onClick={() => pickImage(i)}
                      disabled={busy || imgBusy}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-surface py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
                    >
                      <Icon.image className="size-3.5" />
                      {ko ? "사진 올리기" : "Upload photo"}
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
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-surface py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
                    >
                      <Icon.external className="size-3.5" />
                      {ko ? `${i + 1}번 다운로드` : `Download #${i + 1}`}
                    </button>
                  </div>
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
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">
              {ko
                ? "PNG는 실제 크기(1080×1350)로 다운로드됩니다. 배경 이미지는 카드뉴스에 자동 저장되어 다음에 와도 유지돼요."
                : "PNGs download at full size (1080×1350). Background images are saved to your card news automatically and persist across visits."}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Card className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">
                  {ko ? "함께 올릴 캡션" : "Caption to post with"}
                </h3>
                {selectedPost?.socialCaption && (
                  <CopyButton text={selectedPost.socialCaption} />
                )}
              </div>
              {selectedPost?.socialCaption ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {selectedPost.socialCaption}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  {ko
                    ? "이 글의 캡션이 아직 없어요. 위 'SNS 게시물'에서 만들 수 있어요."
                    : "No caption for this post yet — generate one in 'Social posts' above."}
                </p>
              )}
            </Card>
            <Card className="space-y-4">
              <p className="flex items-center gap-2 font-semibold">
                <Icon.instagramBrand width={18} height={18} />
                {ko ? "이제 인스타그램에 올려보세요" : "Now post it to Instagram"}
              </p>
              <GuideSteps
                steps={[
                  {
                    title: ko
                      ? "'전체 PNG 다운로드'로 카드 이미지를 모두 내려받으세요"
                      : "Download every card with 'Download all PNGs'",
                    desc: ko
                      ? "휴대폰에서 하면 갤러리에 저장돼요."
                      : "On your phone they land in the gallery.",
                  },
                  {
                    title: ko
                      ? "인스타그램 앱에서 ➕ 새 게시물 → 카드를 1번부터 순서대로 선택하세요"
                      : "In the Instagram app, tap ➕ New post and pick the cards in order from #1",
                    desc: ko
                      ? "여러 장을 고르면 옆으로 넘기는 게시물이 돼요."
                      : "Picking several makes a swipeable carousel.",
                  },
                  {
                    title: ko
                      ? "옆의 캡션을 붙여넣고 공유를 누르면 끝!"
                      : "Paste the caption and tap Share — done!",
                  },
                ]}
              />
            </Card>
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
