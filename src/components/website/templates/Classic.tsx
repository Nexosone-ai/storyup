import {
  CONTACT_FIELDS,
  SITE_UI,
  SiteLogo,
  siteLang,
  type TemplateProps,
} from "./shared";
import { SiteNav } from "./SiteNav";
import { SiteSections } from "./SiteSections";
import {
  GalleryBlock,
  BlogBlock,
  MapBlock,
  ContactBlock,
  FooterBlock,
  LandingSections,
} from "./lowerBlocks";

export function ClassicTemplate(props: TemplateProps) {
  const {
    content,
    T,
    Img,
    blogHref,
    editable,
    siteSlug,
    editHref,
    onDeleteSection,
  } = props;
  const { hero, story, offers, whyChooseUs, contact } = content;
  const L = SITE_UI[siteLang(content)];
  const heroPhoto = !!hero.image;
  const showInquiry = !!siteSlug || !!editable;
  const showContact =
    showInquiry || CONTACT_FIELDS.some(([key]) => !!contact[key]);

  const blocks = {
    story: (
      <section id="story" className="mx-auto max-w-3xl px-5 py-16">
        {T({ path: "story.title", value: story.title, as: "h2", className: "mb-5 text-center text-2xl font-semibold tracking-tight" })}
        {T({ path: "story.body", value: story.body, as: "p", className: "whitespace-pre-wrap text-center leading-relaxed text-foreground/85" })}
      </section>
    ),
    offers: (
      <section className="bg-surface-muted/50">
        <div className="mx-auto max-w-5xl px-5 py-16">
          {T({ path: "offers.title", value: offers.title, as: "h2", className: "mb-8 text-center text-2xl font-semibold tracking-tight" })}
          <div className="grid gap-5 md:grid-cols-3">
            {offers.items.map((item, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border bg-white">
                {(item.image || editable) && (
                  <div className="relative aspect-[16/10] w-full border-b border-border">
                    {Img({ path: `offers.items.${i}.image`, value: item.image, aspect: "16:9" })}
                  </div>
                )}
                <div className="p-6">
                  <div className="mb-3 grid size-9 place-items-center rounded-lg bg-primary-soft font-bold text-primary">{i + 1}</div>
                  {T({ path: `offers.items.${i}.title`, value: item.title, as: "h3", className: "mb-2 font-semibold" })}
                  {T({ path: `offers.items.${i}.description`, value: item.description, as: "p", className: "text-sm leading-relaxed text-muted" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),
    whyChooseUs: (
      <section className="mx-auto max-w-5xl px-5 py-16">
        {T({ path: "whyChooseUs.title", value: whyChooseUs.title, as: "h2", className: "mb-8 text-center text-2xl font-semibold tracking-tight" })}
        <div className="grid gap-5 md:grid-cols-3">
          {whyChooseUs.items.map((item, i) => (
            <div key={i} className="text-center">
              {(item.image || editable) && (
                <div className="relative mx-auto mb-4 aspect-square w-20 overflow-hidden rounded-full border border-border">
                  {Img({ path: `whyChooseUs.items.${i}.image`, value: item.image, aspect: "1:1" })}
                </div>
              )}
              {T({ path: `whyChooseUs.items.${i}.title`, value: item.title, as: "h3", className: "mb-2 font-semibold" })}
              {T({ path: `whyChooseUs.items.${i}.description`, value: item.description, as: "p", className: "text-sm leading-relaxed text-muted" })}
            </div>
          ))}
        </div>
      </section>
    ),
    sections: (
      <SiteSections
        sections={content.sections}
        T={T}
        Img={Img}
        editable={editable}
        onDelete={onDeleteSection}
      />
    ),
    gallery: <GalleryBlock {...props} />,
    blog: <BlogBlock {...props} />,
    map: <MapBlock {...props} />,
    contact: <ContactBlock {...props} />,
  };

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <span className="flex min-w-0 items-center gap-2.5">
            <SiteLogo src={hero.logo} fallback={hero.image} />
            {T({ path: "hero.businessName", value: hero.businessName, as: "span", className: "truncate font-bold tracking-tight" })}
          </span>
          <SiteNav
            content={content}
            siteSlug={siteSlug}
            blogHref={blogHref}
            editHref={editHref}
            showContact={showContact}
            tone="light"
          />
        </div>
      </header>

      <section
        className={`relative overflow-hidden border-b border-border ${heroPhoto ? "" : "bg-surface-muted/50"} ${editable && !heroPhoto ? "min-h-[220px]" : ""}`}
      >
        {(heroPhoto || editable) &&
          Img({ path: "hero.image", value: hero.image, kind: "hero", aspect: "16:9" })}
        <div
          className={`relative mx-auto max-w-3xl px-5 py-24 text-center sm:py-28 ${heroPhoto ? "text-white" : ""}`}
        >
          {T({ path: "hero.headline", value: hero.headline, as: "h1", className: "text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl" })}
          {T({ path: "hero.shortDescription", value: hero.shortDescription, as: "p", className: `mx-auto mt-5 max-w-xl text-lg leading-relaxed text-pretty ${heroPhoto ? "text-white/85" : "text-muted"}` })}
          {showContact && (
            <a href="#contact" className="mt-9 inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-xs">
              {T({ path: "hero.ctaLabel", value: hero.ctaLabel || L.inquire, as: "span" })}
            </a>
          )}
        </div>
      </section>

      <LandingSections content={content} blocks={blocks} />
      <FooterBlock content={content} />
    </div>
  );
}
