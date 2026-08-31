import { signOutAction } from "@/app/(auth)/actions";
import { LanguageToggle } from "@/components/marketing/LanguageToggle";
import { Logo } from "@/components/ui/Logo";
import { getDict } from "@/lib/i18n";
import { getProfileName, getUser } from "@/lib/queries";
import Link from "next/link";

export async function MarketingNav() {
  const { locale, t } = await getDict();
  const user = await getUser();
  const name = user ? await getProfileName() : null;

  return (
    <header className="sticky top-0 z-40 border-b border-primary/20 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          <LanguageToggle locale={locale} />
          {user ? (
            <>
              <span
                className="hidden max-w-40 truncate px-2 text-sm font-medium text-foreground sm:block"
                title={user.email ?? undefined}
              >
                {name}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-primary"
                >
                  {t.nav.logout}
                </button>
              </form>
              <Link
                href="/dashboard"
                className="neon-glow inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.1em] text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {t.nav.dashboard}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-primary sm:px-4"
              >
                {t.nav.login}
              </Link>
              <Link
                href="/signup"
                className="neon-glow inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.1em] text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {t.nav.start}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
