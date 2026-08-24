import { Logo } from "@/components/ui/Logo";
import { getDict } from "@/lib/i18n";

export async function Footer() {
  const { t } = await getDict();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Logo />
            <p className="text-sm text-muted">{t.footer.tagline}</p>
          </div>
          <p className="eyebrow">© {new Date().getFullYear()} STORYUP</p>
        </div>
      </div>
    </footer>
  );
}
