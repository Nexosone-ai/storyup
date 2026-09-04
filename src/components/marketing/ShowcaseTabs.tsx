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
    <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-primary/30 via-surface-muted to-accent/20">
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

// 미리보기 iframe이 렌더링하는 가상 브라우저 너비 (데스크톱 레이아웃 기준)
const FRAME_W = 1280;

/**
 * 랜딩페이지 카드 — 실제 사이트 전체를 세로로 긴 미리보기로 축소 렌더링하고,
 * 마우스를 올리면 페이지가 아래에서 위로 스크롤되듯 움직인다.
 */
export function SiteCard({ item }: { item: ShowcaseSiteItem }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [scale, setScale] = useState(0.25);
  const [boxH, setBoxH] = useState(0);
  const [pageH, setPageH] = useState(2400);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      setScale(el.clientWidth / FRAME_W);
      setBoxH(el.clientHeight);
    };
    const raf = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // 같은 오리진이므로 로드 후 실제 페이지 높이를 재서 끝까지 스크롤되게 한다.
  const onFrameLoad = () => {
    try {
      const h =
        frameRef.current?.contentDocument?.documentElement?.scrollHeight;
      if (h && h > 400) setPageH(Math.min(h, 4500));
    } catch {
      // 측정 실패 시 기본 높이 유지
    }
  };

  // 호버 시 이동량: 페이지 끝이 카드 바닥에 닿을 만큼 위로
  const shift = Math.min(0, boxH - pageH * scale);
  const duration = Math.max(1600, Math.abs(shift) * 7);

  return (
    <Link
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={boxRef}
        className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-surface-muted/60 transition group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-lg"
      >
        <div
          className="ease-linear will-change-transform"
          style={{
            transform: `translateY(${hovered ? shift : 0}px)`,
            transition: `transform ${hovered ? duration : 700}ms ${hovered ? "linear" : "ease-out"}`,
          }}
        >
          <div
            style={{
              width: FRAME_W,
              height: pageH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <iframe
              ref={frameRef}
              src={item.href}
              title={item.name}
              width={FRAME_W}
              height={pageH}
              loading="lazy"
              scrolling="no"
              tabIndex={-1}
              aria-hidden
              onLoad={onFrameLoad}
              className="pointer-events-none select-none border-0 bg-white"
            />
          </div>
        </div>
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
