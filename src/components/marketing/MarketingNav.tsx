import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import Link from "next/link";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="hidden rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground sm:block"
          >
            로그인
          </Link>
          <ButtonLink href="/signup" size="sm">
            무료로 시작하기
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
