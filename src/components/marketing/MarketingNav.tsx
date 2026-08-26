import { Logo } from "@/components/ui/Logo";
import { LanguageToggle } from "@/components/marketing/LanguageToggle";
import { getDict } from "@/lib/i18n";
import Link from "next/link";

export async function MarketingNav() {
  const { locale, t } = await getDict();
  return (
    <header className="sticky top-0 z-40 border-b border-primary/20 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          <LanguageToggle locale={locale} />
          <Link
            href="/login"
            className="hidden rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-primary sm:block"
          >
            {t.nav.login}
          </Link>
          <Link
            href="/signup"
            className="neon-glow inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.1em] text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t.nav.start}
          </Link>
        </nav>
      </div>
    </header>
  );
}
