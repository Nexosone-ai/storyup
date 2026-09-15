"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { LanguageToggle } from "@/components/marketing/LanguageToggle";
import type { Locale } from "@/lib/i18n";

/** 모바일 전용 햄버거 메뉴 — 데스크톱에서 숨겨진 마케팅 링크 + 언어 토글을 노출한다. */
export function MarketingMobileNav({
  links,
  locale,
}: {
  links: { href: string; label: string }[];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const Glyph = open ? Icon.x : Icon.menu;

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="메뉴"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
      >
        <Glyph width={22} height={22} />
      </button>

      {open && (
        <>
          {/* 바깥 클릭 시 닫힘 */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-16 z-30 cursor-default bg-foreground/10"
          />
          <div className="absolute inset-x-0 top-full z-40 border-b border-border bg-background shadow-lg">
            <nav className="mx-auto flex max-w-6xl flex-col px-4 py-2 sm:px-8">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                >
                  {l.label}
                </Link>
              ))}
              {/* 언어 선택 — 모바일에서는 메뉴 안에 배치 */}
              <div className="mt-1 flex items-center gap-2 border-t border-border px-2 pb-2 pt-3">
                <span className="text-xs text-muted">Language</span>
                <LanguageToggle locale={locale} />
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
