import Link from "next/link";
import {
  CONTACT_FIELDS,
  SITE_UI,
  SiteEditLink,
  SiteLogo,
  siteLang,
  type TemplateProps,
} from "./shared";
import { LowerSections } from "./LowerSections";

/** Elegant — 세리프 헤드라인 + 넉넉한 여백 + 얇은 구분선, 절제된 고급 느낌. */
export function ElegantTemplate(props: TemplateProps) {
  const { content, T, Img, blogHref, editable, siteSlug, editHref } = props;
  const { hero, story, offers, whyChooseUs, contact } = content;
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  const showContact =
    !!siteSlug || !!editable || CONTACT_FIELDS.some(([k]) => !!contact[k]);
  const serif = { fontFamily: "Georgia, 'Times New Roman', serif" };

  return (
    <div>
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <span className="flex min-w-0 items-center gap-2.5">
            <SiteLogo src={hero.logo} fallback={hero.image} />
            {T({ path: "hero.businessName", value: hero.businessName, as: "span", className: "truncate text-lg tracking-wide", style: serif })}
          </span>
          <nav className="flex items-center gap-6 text-sm text-muted">
            <a href="#story" className="hover:text-foreground">{L.about}</a>
            {showContact && <a href="#contact" className="hover:text-foreground">{L.contact}</a>}
            {blogHref && <Link href={blogHref} className="text-primary">{L.blog}</Link>}
            {editHref && <SiteEditLink href={editHref} lang={lang} />}
          </nav>
        </div>
      </header>

      {/* Hero — 중앙 세리프, 사진은 아래 와이드 */}
      <section className="mx-auto max-w-3xl px-5 py-24 text-center">
        <p className="mb-6 text-xs uppercase tracking-[0.3em] text-primary">{hero.businessName}</p>
        {T({ path: "hero.headline", value: hero.headline, as: "h1", className: "text-4xl leading-[1.15] tracking-tight text-balance sm:text-5xl", style: serif })}
        {T({ path: "hero.shortDescription", value: hero.shortDescription, as: "p", className: "mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted" })}
        {showContact && (
          <a href="#contact" className="mt-9 inline-flex border border-foreground px-8 py-3 text-sm uppercase tracking-[0.15em] hover:bg-foreground hover:text-white">
            {T({ path: "hero.ctaLabel", value: hero.ctaLabel || L.inquire, as: "span" })}
          </a>
        )}
      </section>
      {(hero.image || editable) && (
        <div className="relative mx-auto aspect-[21/9] w-full max-w-5xl overflow-hidden px-5">
          <div className="relative h-full w-full overflow-hidden rounded-sm">
            {Img({ path: "hero.image", value: hero.image, kind: "hero", aspect: "16:9" })}
          </div>
        </div>
      )}

      {/* Story */}
      <section id="story" className="mx-auto max-w-2xl px-5 py-20 text-center">
        <div className="mx-auto mb-7 h-px w-16 bg-foreground/30" />
        {T({ path: "story.title", value: story.title, as: "h2", className: "mb-6 text-3xl tracking-tight", style: serif })}
        {T({ path: "story.body", value: story.body, as: "p", className: "whitespace-pre-wrap text-lg leading-[1.9] text-foreground/75" })}
      </section>

      {/* Offers — 얇은 구분선 리스트 */}
      <section className="border-y border-border">
        <div className="mx-auto max-w-4xl px-5 py-20">
          {T({ path: "offers.title", value: offers.title, as: "h2", className: "mb-10 text-center text-3xl tracking-tight", style: serif })}
          <div className="divide-y divide-border">
            {offers.items.map((item, i) => (
              <div key={i} className="grid gap-5 py-8 md:grid-cols-[1fr_2fr] md:items-center">
                {(item.image || editable) && (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm border border-border">
                    {Img({ path: `offers.items.${i}.image`, value: item.image, aspect: "4:3" })}
                  </div>
                )}
                <div>
                  {T({ path: `offers.items.${i}.title`, value: item.title, as: "h3", className: "text-xl tracking-tight", style: serif })}
                  {T({ path: `offers.items.${i}.description`, value: item.description, as: "p", className: "mt-2 leading-relaxed text-muted" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why — 3열 중앙 */}
      <section className="mx-auto max-w-4xl px-5 py-20">
        {T({ path: "whyChooseUs.title", value: whyChooseUs.title, as: "h2", className: "mb-12 text-center text-3xl tracking-tight", style: serif })}
        <div className="grid gap-10 md:grid-cols-3">
          {whyChooseUs.items.map((item, i) => (
            <div key={i} className="text-center">
              <span className="text-sm uppercase tracking-[0.3em] text-primary">{String(i + 1).padStart(2, "0")}</span>
              {T({ path: `whyChooseUs.items.${i}.title`, value: item.title, as: "h3", className: "mt-3 text-lg tracking-tight", style: serif })}
              {T({ path: `whyChooseUs.items.${i}.description`, value: item.description, as: "p", className: "mt-2 text-sm leading-relaxed text-muted" })}
            </div>
          ))}
        </div>
      </section>

      <LowerSections {...props} tone="default" heading="tracking-tight" />
    </div>
  );
}
