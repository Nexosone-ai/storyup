import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { companyInfoRows } from "@/lib/company";

export async function Footer() {
  const { t } = await getDict();
  const company = companyInfoRows();
  return (
    <footer className="band-dark">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 sm:px-8 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- 정적 로고 에셋 */}
              <img
                src="/images/logo-icon.png"
                alt=""
                className="size-6 object-contain"
              />
            </span>
            <span className="text-[19px] font-extrabold tracking-tight text-white">
              STORY
              <span className="brand-gradient-text">UP</span>
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            {t.footer.desc}
            <br />
            {t.footer.tagline}
          </p>
          <p className="mt-4 text-xs text-white/40">
            © {new Date().getFullYear()} STORYUP. All rights reserved.
          </p>
        </div>
        <nav className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/40">
            {t.footer.productLabel}
          </p>
          {t.footer.product.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <nav className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/40">
            {t.footer.companyLabel}
          </p>
          {t.footer.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {company.length > 0 && (
        <div className="border-t border-white/10 px-6 py-5 sm:px-8">
          <p className="mx-auto max-w-6xl text-xs leading-relaxed text-white/40">
            {company.map(([k, v]) => (
              <span key={k} className="mr-4 inline-block">
                <span className="font-medium">{k}</span> {v}
              </span>
            ))}
          </p>
        </div>
      )}
    </footer>
  );
}
