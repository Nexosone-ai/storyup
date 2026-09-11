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
import { InquiryForm } from "@/components/site/InquiryForm";

export function ClassicTemplate({
  content,
  T,
  Img,
  Gallery,
  blogHref,
  latestPosts,
  editable,
  siteSlug,
}: TemplateProps) {
  const { hero, story, offers, whyChooseUs, contact } = content;
  const L = SITE_UI[siteLang(content)];
  const heroPhoto = !!hero.image;
  const gallery = content.gallery ?? [];
  // 공개 사이트(또는 에디터 미리보기)엔 문의 폼을 보여준다.
  const showInquiry = !!siteSlug || !!editable;
  // 문의 폼이나 연락처 중 하나라도 있으면 Contact 섹션을 노출한다.
  const showContact =
    showInquiry || CONTACT_FIELDS.some(([key]) => !!contact[key]);

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <span className="flex min-w-0 items-center gap-2.5">
            <SiteLogo src={hero.logo} />
            {T({ path: "hero.businessName", value: hero.businessName, as: "span", className: "truncate font-bold tracking-tight" })}
          </span>
          <nav className="flex items-center gap-5 text-sm">
            <a href="#story" className="text-muted hover:text-foreground">{L.about}</a>
            {showContact && (
              <a href="#contact" className="text-muted hover:text-foreground">{L.contact}</a>
            )}
            {blogHref && (
              <Link href={blogHref} className="font-medium text-primary">{L.blog}</Link>
            )}
          </nav>
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

      <section id="story" className="mx-auto max-w-3xl px-5 py-16">
        {T({ path: "story.title", value: story.title, as: "h2", className: "mb-5 text-center text-2xl font-semibold tracking-tight" })}
        {T({ path: "story.body", value: story.body, as: "p", className: "whitespace-pre-wrap text-center leading-relaxed text-foreground/85" })}
      </section>

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

      {(gallery.length > 0 || editable) && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-5 py-16">
            <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">
              Gallery
            </h2>
            {Gallery(gallery)}
          </div>
        </section>
      )}

      {blogHref && latestPosts && latestPosts.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-5 py-16">
            <div className="mb-8 flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">
                {L.latestPosts}
              </h2>
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

      {showContact && (
        <section id="contact" className="bg-surface-muted/50">
          {/* 왼쪽: 사장님이 입력한 연락처 / 오른쪽: 문의 폼 */}
          <div className="mx-auto grid max-w-5xl items-start gap-10 px-5 py-16 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {L.inquire}
              </h2>
              <div className="mt-6 grid gap-2 text-sm text-foreground/85">
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
            {showInquiry && (
              <InquiryForm slug={siteSlug} lang={siteLang(content)} />
            )}
          </div>
        </section>
      )}

      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-5xl px-5 py-8 text-center text-sm text-muted">
          <p className="font-semibold text-foreground">{hero.businessName}</p>
          <p className="mt-1">© {new Date().getFullYear()} {hero.businessName}. Powered by STORYUP.</p>
        </div>
      </footer>
    </div>
  );
}
