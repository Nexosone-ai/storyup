import {
  CONTACT_FIELDS,
  SITE_UI,
  SiteLogo,
  siteLang,
  type TemplateProps,
} from "./shared";
import { SiteNav } from "./SiteNav";
import { LowerSections } from "./LowerSections";

/** Vibrant — 그라디언트 히어로 + 둥근 컬러 카드, 밝고 경쾌한 느낌. */
export function VibrantTemplate(props: TemplateProps) {
  const { content, T, Img, blogHref, editable, siteSlug, editHref } = props;
  const { hero, story, offers, whyChooseUs, contact } = content;
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  const showContact =
    !!siteSlug || !!editable || CONTACT_FIELDS.some(([k]) => !!contact[k]);

  return (
    <div className="bg-white">
      <header className="sticky top-0 z-20 border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <span className="flex min-w-0 items-center gap-2.5">
            <SiteLogo src={hero.logo} fallback={hero.image} />
            {T({ path: "hero.businessName", value: hero.businessName, as: "span", className: "truncate font-extrabold tracking-tight" })}
          </span>
          <SiteNav content={content} siteSlug={siteSlug} blogHref={blogHref} editHref={editHref} showContact={showContact} tone="light" />
        </div>
      </header>

      {/* Hero — 그라디언트 배경 */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-soft via-white to-primary-soft/40">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2 md:py-28">
          <div>
            <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">{hero.businessName}</span>
            {T({ path: "hero.headline", value: hero.headline, as: "h1", className: "mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-balance sm:text-5xl" })}
            {T({ path: "hero.shortDescription", value: hero.shortDescription, as: "p", className: "mt-5 max-w-md text-lg leading-relaxed text-muted" })}
            {showContact && (
              <a href="#contact" className="mt-8 inline-flex rounded-full bg-primary px-7 py-3 font-bold text-primary-foreground shadow-lg shadow-primary/25">
                {T({ path: "hero.ctaLabel", value: hero.ctaLabel || L.inquire, as: "span" })}
              </a>
            )}
          </div>
          {(hero.image || editable) && (
            <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] shadow-xl">
              {Img({ path: "hero.image", value: hero.image, kind: "hero", aspect: "1:1" })}
            </div>
          )}
        </div>
      </section>

      {/* Story */}
      <section id="story" className="mx-auto max-w-3xl px-5 py-20 text-center">
        {T({ path: "story.title", value: story.title, as: "h2", className: "mb-5 text-3xl font-extrabold tracking-tight" })}
        {T({ path: "story.body", value: story.body, as: "p", className: "whitespace-pre-wrap text-lg leading-relaxed text-foreground/80" })}
      </section>

      {/* Offers — 둥근 컬러 카드 */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        {T({ path: "offers.title", value: offers.title, as: "h2", className: "mb-10 text-center text-3xl font-extrabold tracking-tight" })}
        <div className="grid gap-6 md:grid-cols-3">
          {offers.items.map((item, i) => (
            <div key={i} className="rounded-[1.75rem] bg-primary-soft/40 p-7 transition-transform hover:-translate-y-1">
              {(item.image || editable) && (
                <div className="relative mb-5 aspect-square w-full overflow-hidden rounded-3xl">
                  {Img({ path: `offers.items.${i}.image`, value: item.image, aspect: "1:1" })}
                </div>
              )}
              {T({ path: `offers.items.${i}.title`, value: item.title, as: "h3", className: "text-xl font-bold" })}
              {T({ path: `offers.items.${i}.description`, value: item.description, as: "p", className: "mt-2 leading-relaxed text-muted" })}
            </div>
          ))}
        </div>
      </section>

      {/* Why — 알약형 카드 */}
      <section className="bg-surface-muted/50">
        <div className="mx-auto max-w-5xl px-5 py-16">
          {T({ path: "whyChooseUs.title", value: whyChooseUs.title, as: "h2", className: "mb-10 text-center text-3xl font-extrabold tracking-tight" })}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {whyChooseUs.items.map((item, i) => (
              <div key={i} className="flex items-start gap-4 rounded-3xl bg-white p-5 shadow-sm">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                <div>
                  {T({ path: `whyChooseUs.items.${i}.title`, value: item.title, as: "h3", className: "font-bold" })}
                  {T({ path: `whyChooseUs.items.${i}.description`, value: item.description, as: "p", className: "mt-1 text-sm leading-relaxed text-muted" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LowerSections {...props} tone="default" heading="font-extrabold tracking-tight" />
    </div>
  );
}
