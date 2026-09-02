"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";
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
          src="/images/logo-symbol.png"
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

export function SiteCard({ item }: { item: ShowcaseSiteItem }) {
  return (
    <Link
      href={item.href}
      target="_blank"
  rel="noopener noreferrer"
      className="group block overflow-hidden rounded-2xl border border-border bg-surface-muted/60 transition hover:-translate-y-1 hover:border-primary/50"
    >
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 원격 이미지
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <PlaceholderCover />
      )}
      <div className="px-5 py-4">
        <p className="truncate font-semibold group-hover:text-primary">
          {item.name}
        </p>
        <p className="mt-1 line-clamp-1 text-sm text-muted">{item.headline}</p>
      </div>
    </Link>
  );
}

export function PostCard({ item }: { item: ShowcasePostItem }) {
  return (
    <Link
      href={item.href}
      target="_blank"
  rel="noopener noreferrer"
      className="group block overflow-hidden rounded-2xl border border-border bg-surface-muted/60 transition hover:-translate-y-1 hover:border-primary/50"
    >
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
        <p className="text-xs font-medium text-primary">{item.businessName}</p>
        <p className="mt-1 line-clamp-1 font-semibold group-hover:text-primary">
          {item.title}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{item.summary}</p>
      </div>
    </Link>
  );
}

/** 카드뉴스 미리보기 — 실제 SNS 카드(4:5)를 자동 슬라이드로 보여준다. */
export function CardNewsCard({ item }: { item: ShowcaseCardItem }) {
  return (
    <Link
      href={item.href}
      target="_blank"
  rel="noopener noreferrer"
      className="group block overflow-hidden rounded-2xl border border-border bg-surface-muted/60 transition hover:-translate-y-1 hover:border-primary/50"
    >
      <CardNewsSlider item={item} />
      <div className="border-t border-border px-5 py-4">
        <p className="text-xs font-medium text-primary">{item.businessName}</p>
        <p className="mt-1 line-clamp-1 font-semibold group-hover:text-primary">
          {item.title}
        </p>
      </div>
    </Link>
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
