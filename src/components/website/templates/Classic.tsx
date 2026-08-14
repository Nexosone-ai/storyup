import Link from "next/link";
import type { TemplateProps } from "./shared";

const CONTACT: Array<[keyof import("@/types/domain").WebsiteContent["contact"], string]> =
  [
    ["phone", "전화"],
    ["email", "이메일"],
    ["address", "주소"],
    ["instagram", "인스타그램"],
    ["website", "웹사이트"],
  ];

export function ClassicTemplate({
  content,
  T,
  Img,
  blogHref,
  editable,
}: TemplateProps) {
  const { hero, story, offers, whyChooseUs, contact } = content;
  const heroPhoto = !!hero.image;

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          {T({ path: "hero.businessName", value: hero.businessName, as: "span", className: "font-bold tracking-tight" })}
          <nav className="flex items-center gap-5 text-sm">
            <a href="#story" className="text-muted hover:text-foreground">소개</a>
            <a href="#contact" className="text-muted hover:text-foreground">연락처</a>
            {blogHref && (
              <Link href={blogHref} className="font-medium text-primary">블로그</Link>
            )}
          </nav>
        </div>
      </header>

      <section
        className={`relative overflow-hidden border-b border-border ${heroPhoto ? "" : "bg-surface-muted/50"} ${editable && !heroPhoto ? "min-h-[220px]" : ""}`}
      >
        {(heroPhoto || editable) &&
          Img({ path: "hero.image", value: hero.image, kind: "hero" })}
        <div
          className={`relative mx-auto max-w-3xl px-5 py-24 text-center sm:py-28 ${heroPhoto ? "text-white" : ""}`}
        >
          {T({ path: "hero.headline", value: hero.headline, as: "h1", className: "text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl" })}
          {T({ path: "hero.shortDescription", value: hero.shortDescription, as: "p", className: `mx-auto mt-5 max-w-xl text-lg leading-relaxed text-pretty ${heroPhoto ? "text-white/85" : "text-muted"}` })}
          <a href="#contact" className="mt-9 inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-xs">
            {T({ path: "hero.ctaLabel", value: hero.ctaLabel || "문의하기", as: "span" })}
          </a>
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
                    {Img({ path: `offers.items.${i}.image`, value: item.image })}
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
                  {Img({ path: `whyChooseUs.items.${i}.image`, value: item.image })}
                </div>
              )}
              {T({ path: `whyChooseUs.items.${i}.title`, value: item.title, as: "h3", className: "mb-2 font-semibold" })}
              {T({ path: `whyChooseUs.items.${i}.description`, value: item.description, as: "p", className: "text-sm leading-relaxed text-muted" })}
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="bg-surface-muted/50">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Contact</h2>
          <div className="mx-auto grid max-w-md gap-2 text-sm text-foreground/85">
            {CONTACT.map(([key, label]) =>
              editable || contact[key] ? (
                <p key={key}>
                  <span className="mr-2 font-medium text-muted">{label}</span>
                  {T({ path: `contact.${key}`, value: contact[key], as: "span", placeholder: label })}
                </p>
              ) : null,
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-5xl px-5 py-8 text-center text-sm text-muted">
          <p className="font-semibold text-foreground">{hero.businessName}</p>
          <p className="mt-1">© {new Date().getFullYear()} {hero.businessName}. Powered by STORYUP.</p>
        </div>
      </footer>
    </div>
  );
}
