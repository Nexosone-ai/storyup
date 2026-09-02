"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Icon, type IconName } from "@/components/ui/icons";
import { LanguageToggle } from "@/components/marketing/LanguageToggle";
import { signOutAction } from "@/app/(auth)/actions";
import { cn } from "@/utils/cn";
import type { Locale } from "@/lib/i18n";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  exact?: boolean;
  /** 우측에 작게 표시되는 상태 배지 (예: "준비 중"). */
  badge?: string;
  /** 워크플로 단계 번호 — 아이콘 대신 번호 원으로 표시된다. */
  step?: number;
}

export function DashboardShell({
  nav,
  workspace,
  userName,
  heading,
  locale = "ko",
  children,
}: {
  nav: NavItem[];
  /** 현재 작업 중인 비즈니스 워크스페이스 — 메뉴 아래 별도 섹션으로 표시된다. */
  workspace?: { name: string; items: NavItem[] };
  userName: string;
  heading?: string;
  locale?: Locale;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ko = locale === "ko";

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const renderItems = (items: NavItem[]) => (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const ActiveIcon = Icon[item.icon];
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-primary-soft text-primary"
                : "text-muted hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {item.step ? (
              <span
                className={cn(
                  "grid size-[18px] place-items-center rounded-full border text-[10px] font-bold",
                  active
                    ? "border-primary text-primary"
                    : "border-border-strong text-muted group-hover:text-foreground",
                )}
              >
                {item.step}
              </span>
            ) : (
              <ActiveIcon
                className={cn(
                  "size-[18px] transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted group-hover:text-foreground",
                )}
              />
            )}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge && (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const navLinks = (
    <>
      <p className="eyebrow mb-2 px-3">{ko ? "메뉴" : "Menu"}</p>
      {renderItems(nav)}
      {workspace && (
        <div className="mt-6 rounded-xl border border-border bg-surface-muted/50 p-2">
          <p className="eyebrow mb-1.5 truncate px-2 pt-1">
            {ko ? "워크스페이스" : "Workspace"} · {workspace.name}
          </p>
          {renderItems(workspace.items)}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-dvh bg-background">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button
          aria-label="메뉴 열기"
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
        >
          <Icon.menu />
        </button>
      </div>

      <div className="mx-auto flex max-w-[1440px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-3.5 py-5 lg:flex">
          <div className="px-2.5">
            <Logo href="/dashboard" />
          </div>
          <div className="mt-8 flex-1 overflow-y-auto">{navLinks}</div>
          <SidebarFooter userName={userName} locale={locale} />
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute left-0 top-0 flex h-dvh w-72 flex-col bg-surface px-3.5 py-5 shadow-lg">
              <div className="flex items-center justify-between px-2.5">
                <Logo href="/dashboard" />
                <button
                  aria-label="메뉴 닫기"
                  onClick={() => setOpen(false)}
                  className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-muted"
                >
                  <Icon.x />
                </button>
              </div>
              <div className="mt-8 flex-1 overflow-y-auto">{navLinks}</div>
              <SidebarFooter userName={userName} locale={locale} />
            </aside>
          </div>
        )}

        {/* Main */}
        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-5xl">
            {heading && (
              <h1 className="mb-6 text-2xl font-semibold tracking-tight">
                {heading}
              </h1>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarFooter({
  userName,
  locale,
}: {
  userName: string;
  locale: Locale;
}) {
  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <p className="min-w-0 truncate text-sm font-medium">{userName}</p>
        </div>
        <LanguageToggle locale={locale} />
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="mt-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <Icon.logout className="size-[18px]" />
          {locale === "ko" ? "로그아웃" : "Log out"}
        </button>
      </form>
    </div>
  );
}
