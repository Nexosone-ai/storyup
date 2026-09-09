"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { Icon } from "@/components/ui/icons";
import { CardNewsSlider } from "@/components/marketing/CardNewsSlider";
import type {
  ShowcaseSiteItem,
  ShowcasePostItem,
  ShowcaseCardItem,
} from "@/components/marketing/showcaseData";

export interface ShowcaseDict {
  tabSites: string;
  tabBlogs: string;
  tabCards: string;
  more: string;
  empty: string;
}

/** 사진이 없는 카드의 플레이스홀더 — 회색 STORYUP 로고를 얹은 그라데이션. */
function PlaceholderCover() {
  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-primary/30 via-surface-muted to-accent/20">
      <span className="inline-flex items-center gap-2 opacity-50">
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 로고 에셋 (투명 배경) */}
        <img
          src="/images/logo-icon.png"
          alt=""
          aria-hidden
          className="size-7 grayscale"
        />
        <span className="text-lg font-extrabold tracking-tight text-foreground/60">
          STORY<span className="text-foreground/40">UP</span>
        </span>
      </span>
    </div>
  );
}

/**
 * 브라우저 화면 영역 — 사이트의 여러 화면(사진+문구)을 자동으로 슬라이드하며 미리보기한다.
 * (화면에 보일 때만 재생해 카드가 많아도 가볍게 유지)
 */
function SitePreview({
  slides,
  name,
}: {
  slides: ShowcaseSiteItem["slides"];
  name: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(false);
  const n = slides.length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || n <= 1) return;
    const t = setInterval(() => setI((c) => (c + 1) % n), 2800);
    return () => clearInterval(t);
  }, [visible, n]);

  return (
    <div
      ref={ref}
      className="relative aspect-[16/10] w-full overflow-hidden bg-surface-muted"
    >
      {slides.map((s, k) => (
        <div
          key={k}
          className={cn(
            "absolute inset-0 transition-opacity duration-700 ease-out",
            k === i ? "opacity-100" : "opacity-0",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드/AI 원격 이미지 */}
          <img
            src={s.src}
            alt={k === 0 ? name : ""}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {s.caption && (
            <>
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <p className="absolute inset-x-0 bottom-0 line-clamp-2 px-4 pb-7 text-sm font-semibold leading-snug text-white drop-shadow-sm sm:text-base">
                {s.caption}
              </p>
            </>
          )}
        </div>
      ))}
      {n > 1 && (
        <div className="absolute inset-x-0 bottom-2.5 z-10 flex justify-center gap-1">
          {slides.map((_, k) => (
            <span
              key={k}
              className={cn(
                "h-1 rounded-full bg-white transition-all",
                k === i ? "w-4" : "w-1.5 opacity-50",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 랜딩페이지 카드 — 사이트 화면들을 '브라우저 창' 목업 안에서 슬라이드로 미리보기해
 * 한눈에 웹사이트로 읽히게 하고(블로그 썸네일과 구분), 아래에 상호명·헤드라인을 적는다.
 */
export function SiteCard({ item }: { item: ShowcaseSiteItem }) {
  // 주소창에 표시할 도메인+경로 (예: storyup.me/site/slug)
  const displayUrl = `storyup.me${item.href}`;
  // 구버전 캐시 데이터(slides 없음)에도 안전하게 대응
  const slides = item.slides ?? [];
  return (
    <Link
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-lg">
        {/* 브라우저 크롬 — 신호등 점 + 주소창 */}
        <div className="flex items-center gap-2 border-b border-border bg-surface-muted/70 px-3 py-2">
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-muted">
            <Icon.globe width={11} height={11} className="shrink-0" />
            <span className="truncate">{displayUrl}</span>
          </span>
        </div>
        {/* 페이지 화면 — 사진이 있으면 슬라이드, 없으면 문구(상호명·헤드라인) 표지 */}
        {slides.length > 0 ? (
          <SitePreview slides={slides} name={item.name} />
        ) : item.name || item.headline ? (
          <div className="flex aspect-[16/10] w-full items-center bg-gradient-to-br from-primary/25 via-surface-muted to-accent/20 px-6">
            <div className="min-w-0">
              <p className="line-clamp-3 text-lg font-bold leading-snug tracking-tight text-foreground sm:text-xl">
                {item.headline || item.name}
              </p>
              {item.headline && item.name && (
                <p className="mt-1 line-clamp-1 text-xs font-medium text-muted">
                  {item.name}
                </p>
              )}
            </div>
          </div>
        ) : (
          <PlaceholderCover />
        )}
      </div>
      <div className="flex items-center gap-2 px-1 pt-3">
        {item.logo && (
          // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 로고
          <img
            src={item.logo}
            alt=""
            className="h-5 w-auto max-w-20 object-contain"
          />
        )}
        <p className="truncate font-bold tracking-tight group-hover:text-primary">
          {item.name}
        </p>
      </div>
      {item.headline && (
        <p className="mt-0.5 line-clamp-1 px-1 text-sm text-muted">
          {item.headline}
        </p>
      )}
    </Link>
  );
}

export function PostCard({ item }: { item: ShowcasePostItem }) {
  return (
    <Link
      href={item.href}
      target="_blank"
  rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-2xl border border-border bg-surface-muted/60 transition hover:-translate-y-1 hover:border-primary/50"
    >
      {item.hotLabel && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-sm">
          🔥 {item.hotLabel}
        </span>
      )}
      {item.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- AI 생성 원격 이미지
        <img
          src={item.cover}
          alt={item.title}
          loading="lazy"
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <PlaceholderCover />
      )}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-xs font-medium text-primary">
            {item.businessName}
          </p>
          {item.views > 0 && (
            <span className="tnum inline-flex shrink-0 items-center gap-1 text-xs text-muted">
              <Icon.eye width={14} height={14} />
              {item.views.toLocaleString()}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-1 font-semibold group-hover:text-primary">
          {item.title}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{item.summary}</p>
      </div>
    </Link>
  );
}

/** 카드뉴스 미리보기 — 카드 영역은 클릭·스와이프로 넘겨 보고, 아래 정보 영역만 랜딩페이지로 이동한다. */
export function CardNewsCard({ item }: { item: ShowcaseCardItem }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-surface-muted/60 transition hover:-translate-y-1 hover:border-primary/50">
      <CardNewsSlider item={item} />
      <Link
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block border-t border-border px-5 py-4"
      >
        <p className="text-xs font-medium text-primary">{item.businessName}</p>
        <p className="mt-1 line-clamp-1 font-semibold group-hover:text-primary">
          {item.title}
        </p>
      </Link>
    </div>
  );
}

export function ShowcaseTabs({
  sites,
  posts,
  cards = [],
  t,
}: {
  sites: ShowcaseSiteItem[];
  posts: ShowcasePostItem[];
  cards?: ShowcaseCardItem[];
  t: ShowcaseDict;
}) {
  const [tab, setTab] = useState<"site" | "blog" | "cards">("site");
  const items = tab === "site" ? sites : tab === "blog" ? posts : cards;

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-2">
        {(
          [
            ["site", t.tabSites],
            ["blog", t.tabBlogs],
            ["cards", t.tabCards],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-5 py-2 font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.15em] transition-colors",
              tab === key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted hover:border-primary/50 hover:text-primary",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="py-12 text-center text-muted">{t.empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tab === "site"
            ? sites.map((s) => <SiteCard key={s.href} item={s} />)
            : tab === "blog"
              ? posts.map((p) => <PostCard key={p.href} item={p} />)
              : cards.map((c) => <CardNewsCard key={c.id} item={c} />)}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link
          href={`/showcase?tab=${tab}`}
          className="inline-flex rounded-lg border border-primary px-8 py-3 font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.15em] text-primary transition-all duration-300 hover:bg-primary/10"
        >
          {t.more}
        </Link>
      </div>
    </div>
  );
}
