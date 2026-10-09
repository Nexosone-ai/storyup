import {
  CONTACT_FIELDS,
  SITE_UI,
  SiteLogo,
  siteLang,
  type TemplateProps,
} from "./shared";
import { SiteNav } from "./SiteNav";
import { LowerSections } from "./LowerSections";

/** Bold — 다크 히어로 + 큰 타이포 + 강한 대비, 번호형 굵은 카드. */
export function BoldTemplate(props: TemplateProps) {
  const { content, T, Img, blogHref, editable, siteSlug, editHref } = props;
  const { hero, story, offers, whyChooseUs, contact } = content;
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  const showContact =
    !!siteSlug || !!editable || CONTACT_FIELDS.some(([k]) => !!contact[k]);

  return (
    <div>
      <header className="sticky top-0 z-20 bg-foreground text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <span className="flex min-w-0 items-center gap-2.5">
            <SiteLogo src={hero.logo} fallback={hero.image} />
            {T({ path: "hero.businessName", value: hero.businessName, as: "span", className: "truncate text-lg font-extrabold uppercase tracking-tight" })}
          </span>
          <SiteNav content={content} siteSlug={siteSlug} blogHref={blogHref} editHref={editHref} showContact={showContact} tone="dark" />
        </div>
      </header>

      {/* Hero — 다크, 초대형 헤드라인 */}
      <section className="relative overflow-hidden bg-foreground text-white">
        {(hero.image || editable) && (
          <div className="absolute inset-0 opacity-30">
            {Img({ path: "hero.image", value: hero.image, kind: "hero", aspect: "16:9" })}
          </div>
        )}
        <div className="relative mx-auto max-w-5xl px-5 py-28 sm:py-36">
          {T({ path: "hero.headline", value: hero.headline, as: "h1", className: "max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight text-balance sm:text-7xl" })}
          {T({ path: "hero.shortDescription", value: hero.shortDescription, as: "p", className: "mt-6 max-w-xl text-lg leading-relaxed text-white/75" })}
          {showContact && (
            <a href="#contact" className="mt-10 inline-flex rounded-full bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground">
              {T({ path: "hero.ctaLabel", value: hero.ctaLabel || L.inquire, as: "span" })}
            </a>
          )}
        </div>
      </section>

      {/* Story */}
      <section id="story" className="mx-auto max-w-3xl px-5 py-20">
        {T({ path: "story.title", value: story.title, as: "h2", className: "mb-5 text-3xl font-extrabold tracking-tight" })}
        {T({ path: "story.body", value: story.body, as: "p", className: "whitespace-pre-wrap text-lg leading-relaxed text-foreground/80" })}
      </section>

      {/* Offers — 번호형 굵은 카드 */}
      <section className="bg-surface-muted/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          {T({ path: "offers.title", value: offers.title, as: "h2", className: "mb-10 text-3xl font-extrabold tracking-tight" })}
          <div className="grid gap-6 md:grid-cols-3">
            {offers.items.map((item, i) => (
              <div key={i} className="rounded-3xl border-2 border-foreground bg-white p-7">
                <span className="text-5xl font-black text-primary">{String(i + 1).padStart(2, "0")}</span>
                {(item.image || editable) && (
                  <div className="relative mt-4 aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border">
                    {Img({ path: `offers.items.${i}.image`, value: item.image, aspect: "16:9" })}
                  </div>
                )}
                {T({ path: `offers.items.${i}.title`, value: item.title, as: "h3", className: "mt-4 text-xl font-bold" })}
                {T({ path: `offers.items.${i}.description`, value: item.description, as: "p", className: "mt-2 leading-relaxed text-muted" })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why — 큰 번호 가로 리스트 */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        {T({ path: "whyChooseUs.title", value: whyChooseUs.title, as: "h2", className: "mb-10 text-3xl font-extrabold tracking-tight" })}
        <div className="space-y-6">
          {whyChooseUs.items.map((item, i) => (
            <div key={i} className="flex items-start gap-6 border-b border-border pb-6">
              <span className="shrink-0 text-4xl font-black text-primary/30">{String(i + 1).padStart(2, "0")}</span>
              <div>
                {T({ path: `whyChooseUs.items.${i}.title`, value: item.title, as: "h3", className: "text-xl font-bold" })}
                {T({ path: `whyChooseUs.items.${i}.description`, value: item.description, as: "p", className: "mt-1.5 leading-relaxed text-muted" })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <LowerSections {...props} tone="dark" heading="font-extrabold tracking-tight" />
    </div>
  );
}
