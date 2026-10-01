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

/** Warm — 크림 배경 + 둥근 부드러운 카드, 왼쪽 정렬의 아늑하고 친근한 느낌. */
export function WarmTemplate(props: TemplateProps) {
  const { content, T, Img, blogHref, editable, siteSlug, editHref } = props;
  const { hero, story, offers, whyChooseUs, contact } = content;
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  const showContact =
    !!siteSlug || !!editable || CONTACT_FIELDS.some(([k]) => !!contact[k]);
  const cream = { backgroundColor: "#fbf7f1" };

  return (
    <div style={cream}>
      <header className="sticky top-0 z-20 border-b border-border/60" style={cream}>
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <span className="flex min-w-0 items-center gap-2.5">
            <SiteLogo src={hero.logo} fallback={hero.image} />
            {T({ path: "hero.businessName", value: hero.businessName, as: "span", className: "truncate text-lg font-bold tracking-tight" })}
          </span>
          <nav className="flex items-center gap-5 text-sm text-muted">
            <a href="#story" className="hover:text-foreground">{L.about}</a>
            {showContact && <a href="#contact" className="hover:text-foreground">{L.contact}</a>}
            {blogHref && <Link href={blogHref} className="font-semibold text-primary">{L.blog}</Link>}
            {editHref && <SiteEditLink href={editHref} lang={lang} />}
          </nav>
        </div>
      </header>

      {/* Hero — 좌측 텍스트 + 둥근 사진 */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-20 md:grid-cols-2">
        <div>
          {T({ path: "hero.headline", value: hero.headline, as: "h1", className: "text-4xl font-bold leading-[1.1] tracking-tight text-balance sm:text-5xl" })}
          {T({ path: "hero.shortDescription", value: hero.shortDescription, as: "p", className: "mt-5 max-w-md text-lg leading-relaxed text-foreground/70" })}
          {showContact && (
            <a href="#contact" className="mt-8 inline-flex rounded-full bg-primary px-7 py-3 font-semibold text-primary-foreground">
              {T({ path: "hero.ctaLabel", value: hero.ctaLabel || L.inquire, as: "span" })}
            </a>
          )}
        </div>
        {(hero.image || editable) && (
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2.5rem]">
            {Img({ path: "hero.image", value: hero.image, kind: "hero", aspect: "3:4" })}
          </div>
        )}
      </section>

      {/* Story — 둥근 카드 */}
      <section id="story" className="mx-auto max-w-3xl px-5 pb-16">
        <div className="rounded-[2rem] bg-white/70 p-9">
          {T({ path: "story.title", value: story.title, as: "h2", className: "mb-4 text-2xl font-bold tracking-tight" })}
          {T({ path: "story.body", value: story.body, as: "p", className: "whitespace-pre-wrap leading-[1.9] text-foreground/75" })}
        </div>
      </section>

      {/* Offers — 부드러운 카드 */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        {T({ path: "offers.title", value: offers.title, as: "h2", className: "mb-8 text-2xl font-bold tracking-tight" })}
        <div className="grid gap-6 md:grid-cols-3">
          {offers.items.map((item, i) => (
            <div key={i} className="overflow-hidden rounded-[1.75rem] bg-white/70">
              {(item.image || editable) && (
                <div className="relative aspect-[16/11] w-full">
                  {Img({ path: `offers.items.${i}.image`, value: item.image, aspect: "16:9" })}
                </div>
              )}
              <div className="p-6">
                {T({ path: `offers.items.${i}.title`, value: item.title, as: "h3", className: "font-bold" })}
                {T({ path: `offers.items.${i}.description`, value: item.description, as: "p", className: "mt-2 text-sm leading-relaxed text-muted" })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why — 체크 리스트 */}
      <section className="mx-auto max-w-3xl px-5 py-14">
        {T({ path: "whyChooseUs.title", value: whyChooseUs.title, as: "h2", className: "mb-8 text-2xl font-bold tracking-tight" })}
        <div className="space-y-5">
          {whyChooseUs.items.map((item, i) => (
            <div key={i} className="flex items-start gap-4">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">✓</span>
              <div>
                {T({ path: `whyChooseUs.items.${i}.title`, value: item.title, as: "h3", className: "font-bold" })}
                {T({ path: `whyChooseUs.items.${i}.description`, value: item.description, as: "p", className: "mt-1 text-sm leading-relaxed text-muted" })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <LowerSections {...props} tone="soft" heading="font-bold tracking-tight" />
    </div>
  );
}
