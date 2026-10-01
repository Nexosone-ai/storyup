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

/** Modern — 샤프한 엣지 + 모노 라벨 + 그리드 라인, 세련된 테크 느낌. */
export function ModernTemplate(props: TemplateProps) {
  const { content, T, Img, blogHref, editable, siteSlug, editHref } = props;
  const { hero, story, offers, whyChooseUs, contact } = content;
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  const showContact =
    !!siteSlug || !!editable || CONTACT_FIELDS.some(([k]) => !!contact[k]);
  const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };

  return (
    <div className="bg-white">
      <header className="sticky top-0 z-20 border-b border-foreground/15 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <span className="flex min-w-0 items-center gap-2.5">
            <SiteLogo src={hero.logo} fallback={hero.image} />
            {T({ path: "hero.businessName", value: hero.businessName, as: "span", className: "truncate font-semibold tracking-tight" })}
          </span>
          <nav className="flex items-center gap-6 text-xs uppercase tracking-widest text-muted" style={mono}>
            <a href="#story" className="hover:text-foreground">{L.about}</a>
            {showContact && <a href="#contact" className="hover:text-foreground">{L.contact}</a>}
            {blogHref && <Link href={blogHref} className="font-semibold text-primary">{L.blog}</Link>}
            {editHref && <SiteEditLink href={editHref} lang={lang} />}
          </nav>
        </div>
      </header>

      {/* Hero — 좌 텍스트/우 사각 이미지, 상단 모노 라벨 */}
      <section className="border-b border-foreground/15">
        <div className="mx-auto grid max-w-6xl items-stretch gap-0 md:grid-cols-2">
          <div className="flex flex-col justify-center px-5 py-20 md:pr-12">
            <p className="mb-5 text-xs uppercase tracking-[0.3em] text-primary" style={mono}>— {hero.businessName}</p>
            {T({ path: "hero.headline", value: hero.headline, as: "h1", className: "text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl" })}
            {T({ path: "hero.shortDescription", value: hero.shortDescription, as: "p", className: "mt-6 max-w-md text-lg leading-relaxed text-muted" })}
            {showContact && (
              <a href="#contact" className="mt-8 inline-flex w-fit items-center gap-2 bg-foreground px-7 py-3 text-sm font-semibold text-white hover:bg-primary">
                {T({ path: "hero.ctaLabel", value: hero.ctaLabel || L.inquire, as: "span" })}
                <span aria-hidden>→</span>
              </a>
            )}
          </div>
          {(hero.image || editable) && (
            <div className="relative min-h-[320px] border-foreground/15 md:border-l">
              {Img({ path: "hero.image", value: hero.image, kind: "hero", aspect: "4:3" })}
            </div>
          )}
        </div>
      </section>

      {/* Story */}
      <section id="story" className="border-b border-foreground/15">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-20 md:grid-cols-[200px_1fr]">
          <p className="text-xs uppercase tracking-[0.3em] text-muted" style={mono}>01 / Story</p>
          <div>
            {T({ path: "story.title", value: story.title, as: "h2", className: "mb-4 text-2xl font-semibold tracking-tight" })}
            {T({ path: "story.body", value: story.body, as: "p", className: "whitespace-pre-wrap text-lg leading-[1.8] text-foreground/80" })}
          </div>
        </div>
      </section>

      {/* Offers — 그리드 라인 카드 */}
      <section className="border-b border-foreground/15">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-10 flex items-baseline gap-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted" style={mono}>02 / Offers</p>
            {T({ path: "offers.title", value: offers.title, as: "h2", className: "text-2xl font-semibold tracking-tight" })}
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-foreground/15 bg-foreground/15 md:grid-cols-3">
            {offers.items.map((item, i) => (
              <div key={i} className="bg-white p-7">
                <span className="text-xs text-muted" style={mono}>{String(i + 1).padStart(2, "0")}</span>
                {(item.image || editable) && (
                  <div className="relative mt-4 aspect-[16/10] w-full overflow-hidden">
                    {Img({ path: `offers.items.${i}.image`, value: item.image, aspect: "16:9" })}
                  </div>
                )}
                {T({ path: `offers.items.${i}.title`, value: item.title, as: "h3", className: "mt-4 font-semibold" })}
                {T({ path: `offers.items.${i}.description`, value: item.description, as: "p", className: "mt-2 text-sm leading-relaxed text-muted" })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section>
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-10 flex items-baseline gap-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted" style={mono}>03 / Why us</p>
            {T({ path: "whyChooseUs.title", value: whyChooseUs.title, as: "h2", className: "text-2xl font-semibold tracking-tight" })}
          </div>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
            {whyChooseUs.items.map((item, i) => (
              <div key={i}>
                <span className="text-xs text-primary" style={mono}>{String(i + 1).padStart(2, "0")}</span>
                {T({ path: `whyChooseUs.items.${i}.title`, value: item.title, as: "h3", className: "mt-2 font-semibold" })}
                {T({ path: `whyChooseUs.items.${i}.description`, value: item.description, as: "p", className: "mt-1.5 text-sm leading-relaxed text-muted" })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <LowerSections {...props} tone="default" heading="font-semibold tracking-tight" />
    </div>
  );
}
