import { getDict } from "@/lib/i18n";

export async function Footer() {
  const { t } = await getDict();
  return (
    <footer className="border-t border-[#e2e2e2] bg-white text-[#1a1c1c]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 py-12 sm:px-8 md:grid-cols-3">
        <div className="flex flex-col gap-3">
          <span className="font-[family-name:var(--font-serif)] text-[26px] font-normal text-[#554b73]">
            StoryUp
          </span>
          <p className="text-sm text-[#48454e]">{t.footer.tagline}</p>
          <p className="text-sm text-[#48454e]">
            © {new Date().getFullYear()} STORYUP
          </p>
        </div>
        <nav className="flex flex-col gap-4 sm:flex-row md:col-span-2 md:items-start md:justify-end">
          {t.footer.links.map((label) => (
            <span
              key={label}
              className="font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.15em] text-[#48454e] underline decoration-[#554b73]/30 underline-offset-4 transition-colors hover:text-[#554b73]"
            >
              {label}
            </span>
          ))}
        </nav>
      </div>
    </footer>
  );
}
