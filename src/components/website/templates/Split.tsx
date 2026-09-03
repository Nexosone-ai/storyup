import Link from "next/link";
import {
  CONTACT_FIELDS,
  ContactEntry,
  SITE_UI,
  SiteLogo,
  siteLang,
  type TemplateProps,
} from "./shared";
import { BlogPreviewCards } from "./BlogPreview";

export function SplitTemplate({
  content,
  T,
  Img,
  Gallery,
  blogHref,
  latestPosts,
  editable,
}: TemplateProps) {
  const { hero, story, offers, whyChooseUs, contact } = content;
  const L = SITE_UI[siteLang(content)];
  const gallery = content.gallery ?? [];
  // 연락처가 하나도 없으면 공개 화면에서 Contact 섹션·링크를 숨긴다
  const showContact =
    !!editable || CONTACT_FIELDS.some(([key]) => !!contact[key]);

  return (
    <div className="bg-white">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="flex min-w-0 items-center gap-2.5">
            <SiteLogo src={hero.logo} />
            {T({ path: "hero.businessName", value: hero.businessName, as: "span", className: "truncate font-bold tracking-tight" })}
          </span>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#story" className="text-muted hover:text-foreground">{L.about}</a>
            {showContact && (
              <a href="#contact" className="text-muted hover:text-foreground">{L.contact}</a>
            )}
            {blogHref && <Link href={blogHref} className="font-medium text-primary">{L.blog}</Link>}
          </nav>
        </div>
      </header>

      {/* Hero — split */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p className="eyebrow mb-5">Welcome</p>
            {T({ path: "hero.headline", value: hero.headline, as: "h1", className: "text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl" })}
            {T({ path: "hero.shortDescription", value: hero.shortDescription, as: "p", className: "mt-6 max-w-lg text-lg leading-relaxed text-muted text-pretty" })}
            {showContact && (
              <a href="#contact" className="mt-8 inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-xs">
                {T({ path: "hero.ctaLabel", value: hero.ctaLabel || L.inquire, as: "span" })}
              </a>
            )}
          </div>
          <div className="relative hidden aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-primary-soft md:block">
            {Img({ path: "hero.image", value: hero.image, kind: "cover" })}
          </div>
        </div>
      </section>

      {/* Story — labeled two-col */}
      <section id="story" className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-[240px_1fr]">
          <div>
            <p className="eyebrow mb-2">Our Story</p>
            {T({ path: "story.title", value: story.title, as: "h2", className: "text-2xl font-semibold tracking-tight" })}
          </div>
          {T({ path: "story.body", value: story.body, as: "p", className: "whitespace-pre-wrap text-lg leading-relaxed text-foreground/85" })}
        </div>
      </section>

      {/* Offers — numbered rows */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="eyebrow mb-2">What We Offer</p>
          {T({ path: "offers.title", value: offers.title, as: "h2", className: "mb-8 text-2xl font-semibold tracking-tight" })}
          <div className="divide-y divide-border border-y border-border">
            {offers.items.map((item, i) => (
              <div key={i} className="grid gap-4 py-6 md:grid-cols-[120px_1fr_1.6fr] md:items-start">
                {item.image || editable ? (
                  <div className="relative aspect-square w-full max-w-[120px] overflow-hidden rounded-lg border border-border">
                    {Img({ path: `offers.items.${i}.image`, value: item.image })}
                  </div>
                ) : (
                  <span className="eyebrow text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                )}
                {T({ path: `offers.items.${i}.title`, value: item.title, as: "h3", className: "text-lg font-semibold" })}
                {T({ path: `offers.items.${i}.description`, value: item.description, as: "p", className: "text-muted" })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why us — 3 col big */}
      <section className="border-b border-border bg-surface-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="eyebrow mb-2">Why Choose Us</p>
          {T({ path: "whyChooseUs.title", value: whyChooseUs.title, as: "h2", className: "mb-8 text-2xl font-semibold tracking-tight" })}
          <div className="grid gap-8 md:grid-cols-3">
            {whyChooseUs.items.map((item, i) => (
              <div key={i}>
                {(item.image || editable) && (
                  <div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-xl border border-border">
                    {Img({ path: `whyChooseUs.items.${i}.image`, value: item.image })}
                  </div>
                )}
                {T({ path: `whyChooseUs.items.${i}.title`, value: item.title, as: "h3", className: "mb-2 text-lg font-semibold" })}
                {T({ path: `whyChooseUs.items.${i}.description`, value: item.description, as: "p", className: "leading-relaxed text-muted" })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {(gallery.length > 0 || editable) && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="eyebrow mb-2">Gallery</p>
            <h2 className="mb-8 text-2xl font-semibold tracking-tight">{L.space}</h2>
            {Gallery(gallery)}
          </div>
        </section>
      )}

      {blogHref && latestPosts && latestPosts.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-8 flex items-baseline justify-between">
              <div>
                <p className="eyebrow mb-2">Blog</p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {L.latestPosts}
                </h2>
              </div>
              <Link href={blogHref} className="text-sm font-medium text-primary">
                {L.viewAll}
              </Link>
            </div>
            <BlogPreviewCards
              posts={latestPosts}
              blogHref={blogHref}
              lang={siteLang(content)}
            />
          </div>
        </section>
      )}

      {/* Contact */}
      {showContact && (
        <section id="contact">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-[240px_1fr]">
            <div>
              <p className="eyebrow mb-2">Contact</p>
              <h2 className="text-2xl font-semibold tracking-tight">{L.inquire}</h2>
            </div>
            <div className="grid gap-2 text-foreground/85 sm:grid-cols-2">
              {CONTACT_FIELDS.map(([key, ko, en]) => (
                <ContactEntry
                  key={key}
                  k={key}
                  label={siteLang(content) === "en" ? en : ko}
                  value={contact[key] ?? ""}
                  T={T}
                  editable={editable}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted">
          <span className="font-semibold text-foreground">{hero.businessName}</span>
          <span className="ml-3">© {new Date().getFullYear()} · Powered by STORYUP</span>
        </div>
      </footer>
    </div>
  );
}
