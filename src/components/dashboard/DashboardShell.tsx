"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Icon, type IconName } from "@/components/ui/icons";
import { signOutAction } from "@/app/(auth)/actions";
import { cn } from "@/utils/cn";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  exact?: boolean;
}

export function DashboardShell({
  nav,
  back,
  userName,
  heading,
  children,
}: {
  nav: NavItem[];
  /** 상위 화면으로 돌아가는 링크 — 메뉴와 분리된 박스로 표시된다. */
  back?: { label: string; href: string };
  userName: string;
  heading?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const backLink = back && (
    <Link
      href={back.href}
      onClick={() => setOpen(false)}
      className="group mb-5 flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted/60 px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
    >
      <Icon.arrowLeft className="size-[18px] text-muted transition-colors group-hover:text-primary" />
      {back.label}
    </Link>
  );

  const navLinks = (
    <nav className="flex flex-col gap-0.5">
      {nav.map((item) => {
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
            <ActiveIcon
              className={cn(
                "size-[18px] transition-colors",
                active ? "text-primary" : "text-muted group-hover:text-foreground",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
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
          <div className="mt-8 flex-1">
            {backLink}
            <p className="eyebrow mb-2 px-3">메뉴</p>
            {navLinks}
          </div>
          <SidebarFooter userName={userName} />
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
              <div className="mt-8 flex-1">
                {backLink}
                <p className="eyebrow mb-2 px-3">메뉴</p>
                {navLinks}
              </div>
              <SidebarFooter userName={userName} />
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

function SidebarFooter({ userName }: { userName: string }) {
  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
        <div className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {userName.slice(0, 1).toUpperCase()}
        </div>
        <p className="min-w-0 truncate text-sm font-medium">{userName}</p>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="mt-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <Icon.logout className="size-[18px]" />
          로그아웃
        </button>
      </form>
    </div>
  );
}
