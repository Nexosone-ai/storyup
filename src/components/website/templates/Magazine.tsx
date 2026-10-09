import {
  CONTACT_FIELDS,
  SITE_UI,
  SiteLogo,
  siteLang,
  type TemplateProps,
} from "./shared";
import { SiteNav } from "./SiteNav";
import { LowerSections } from "./LowerSections";

/** Magazine — 대형 오버레이 히어로 + 좌우 교차 피처 행, 잡지 편집 느낌. */
export function MagazineTemplate(props: TemplateProps) {
  const { content, T, Img, blogHref, editable, siteSlug, editHref } = props;
  const { hero, story, offers, whyChooseUs, contact } = content;
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  const showContact =
    !!siteSlug || !!editable || CONTACT_FIELDS.some(([k]) => !!contact[k]);
  const heroPhoto = !!hero.image;

  return (
    <div>
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 text-white">
          <span className="flex min-w-0 items-center gap-2.5">
            <SiteLogo src={hero.logo} fallback={hero.image} />
            {T({ path: "hero.businessName", value: hero.businessName, as: "span", className: "truncate font-bold uppercase tracking-[0.2em]" })}
          </span>
          <SiteNav content={content} siteSlug={siteSlug} blogHref={blogHref} editHref={editHref} showContact={showContact} tone="dark" />
        </div>
      </header>

      {/* Hero — 풀블리드 이미지 + 오버레이 타이틀 */}
      <section className="relative min-h-[520px] overflow-hidden bg-foreground text-white">
        {(heroPhoto || editable) && (
          <div className="absolute inset-0 opacity-60">
            {Img({ path: "hero.image", value: hero.image, kind: "hero", aspect: "16:9" })}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
        <div className="relative mx-auto flex min-h-[520px] max-w-5xl flex-col justify-end px-5 pb-16 pt-28">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/70">{hero.businessName}</p>
          {T({ path: "hero.headline", value: hero.headline, as: "h1", className: "max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-6xl" })}
          {T({ path: "hero.shortDescription", value: hero.shortDescription, as: "p", className: "mt-5 max-w-xl text-lg leading-relaxed text-white/85" })}
          {showContact && (
            <a href="#contact" className="mt-8 inline-flex w-fit border border-white px-7 py-3 text-sm font-semibold uppercase tracking-wider hover:bg-white hover:text-foreground">
              {T({ path: "hero.ctaLabel", value: hero.ctaLabel || L.inquire, as: "span" })}
            </a>
          )}
        </div>
      </section>

      {/* Story — 2열 */}
      <section id="story" className="mx-auto max-w-5xl px-5 py-20">
        <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
          {T({ path: "story.title", value: story.title, as: "h2", className: "text-3xl font-bold leading-tight tracking-tight" })}
          {T({ path: "story.body", value: story.body, as: "p", className: "whitespace-pre-wrap text-lg leading-[1.8] text-foreground/80" })}
        </div>
      </section>

      {/* Offers — 좌우 교차 피처 행 */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-5 py-16">
          {T({ path: "offers.title", value: offers.title, as: "h2", className: "mb-12 text-3xl font-bold tracking-tight" })}
          <div className="space-y-14">
            {offers.items.map((item, i) => (
              <div key={i} className={`grid items-center gap-8 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
                {(item.image || editable) && (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border">
                    {Img({ path: `offers.items.${i}.image`, value: item.image, aspect: "4:3" })}
                  </div>
                )}
                <div>
                  <span className="text-sm font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
                  {T({ path: `offers.items.${i}.title`, value: item.title, as: "h3", className: "mt-2 text-2xl font-bold tracking-tight" })}
                  {T({ path: `offers.items.${i}.description`, value: item.description, as: "p", className: "mt-3 text-lg leading-relaxed text-muted" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why — 밑줄 리스트 */}
      <section className="bg-surface-muted/50">
        <div className="mx-auto max-w-5xl px-5 py-16">
          {T({ path: "whyChooseUs.title", value: whyChooseUs.title, as: "h2", className: "mb-8 text-3xl font-bold tracking-tight" })}
          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {whyChooseUs.items.map((item, i) => (
              <div key={i} className="border-t-2 border-foreground pt-4">
                {T({ path: `whyChooseUs.items.${i}.title`, value: item.title, as: "h3", className: "text-lg font-bold" })}
                {T({ path: `whyChooseUs.items.${i}.description`, value: item.description, as: "p", className: "mt-1.5 leading-relaxed text-muted" })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <LowerSections {...props} tone="default" heading="font-bold tracking-tight" />
    </div>
  );
}
