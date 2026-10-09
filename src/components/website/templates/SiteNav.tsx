"use client";

import { useState } from "react";
import Link from "next/link";
import type { WebsiteContent } from "@/types/domain";
import { SITE_UI, SiteEditLink, siteLang } from "./shared";

/**
 * 사이트 상단 내비게이션 (홈 템플릿 헤더 + 서브페이지 공통).
 * - 멀티페이지(content.pages)가 있으면 [홈 · 각 페이지 · 블로그]를 링크한다.
 * - 없으면 기존 동작([소개(#story) · 연락처(#contact) · 블로그])을 그대로 유지(하위호환).
 * - 모바일에서는 햄버거 메뉴로 접힌다. tone으로 밝은/어두운 헤더 색을 맞춘다.
 */

export interface NavItem {
  label: string;
  href: string;
  primary?: boolean;
}

export function buildSiteNavItems(
  content: WebsiteContent,
  opts: { siteSlug?: string; blogHref?: string; showContact?: boolean },
): NavItem[] {
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  const base = opts.siteSlug ? `/site/${opts.siteSlug}` : "";
  const pages = (content.pages ?? []).filter((p) => p.showInNav && p.slug);
  const items: NavItem[] = [];

  if (pages.length > 0) {
    items.push({ label: L.home, href: base || "#" });
    for (const p of pages)
      items.push({
        label: p.navLabel || p.slug,
        href: base ? `${base}/${p.slug}` : "#",
      });
    if (opts.showContact)
      items.push({ label: L.contact, href: `${base}#contact` });
  } else {
    items.push({ label: L.about, href: `${base}#story` });
    if (opts.showContact)
      items.push({ label: L.contact, href: `${base}#contact` });
  }
  if (opts.blogHref)
    items.push({ label: L.blog, href: opts.blogHref, primary: true });
  return items;
}

export function SiteNav({
  content,
  siteSlug,
  blogHref,
  editHref,
  showContact = false,
  tone = "light",
  className = "",
}: {
  content: WebsiteContent;
  siteSlug?: string;
  blogHref?: string;
  editHref?: string;
  showContact?: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const lang = siteLang(content);
  const items = buildSiteNavItems(content, { siteSlug, blogHref, showContact });

  const linkCls = (it: NavItem) =>
    it.primary
      ? tone === "dark"
        ? "font-semibold text-white"
        : "font-medium text-primary"
      : tone === "dark"
        ? "text-white/80 hover:text-white"
        : "text-muted hover:text-foreground";

  const renderLink = (it: NavItem, i: number, onClick?: () => void) =>
    it.href.startsWith("/") ? (
      <Link key={i} href={it.href} onClick={onClick} className={linkCls(it)}>
        {it.label}
      </Link>
    ) : (
      <a key={i} href={it.href} onClick={onClick} className={linkCls(it)}>
        {it.label}
      </a>
    );

  return (
    <nav className={`flex items-center gap-5 text-sm ${className}`}>
      {/* 데스크톱 */}
      <span className="hidden items-center gap-5 sm:flex">
        {items.map((it, i) => renderLink(it, i))}
        {editHref && <SiteEditLink href={editHref} lang={lang} />}
      </span>

      {/* 모바일 햄버거 */}
      <span className="relative sm:hidden">
        {editHref && (
          <span className="mr-3">
            <SiteEditLink href={editHref} lang={lang} />
          </span>
        )}
        <button
          type="button"
          aria-label="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={tone === "dark" ? "text-white" : "text-foreground"}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {open && (
          <div className="absolute right-0 top-9 z-30 min-w-40 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg">
            {items.map((it, i) =>
              it.href.startsWith("/") ? (
                <Link
                  key={i}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-foreground hover:bg-surface-muted"
                >
                  {it.label}
                </Link>
              ) : (
                <a
                  key={i}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-foreground hover:bg-surface-muted"
                >
                  {it.label}
                </a>
              ),
            )}
          </div>
        )}
      </span>
    </nav>
  );
}
