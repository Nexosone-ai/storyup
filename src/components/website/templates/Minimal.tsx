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

export function MinimalTemplate({
  content,
  T,
  Img,
  blogHref,
  editable,
}: TemplateProps) {
  const { hero, story, offers, whyChooseUs, contact } = content;

  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-6 py-8">
        {T({ path: "hero.businessName", value: hero.businessName, as: "span", className: "text-sm font-semibold uppercase tracking-[0.2em]" })}
        {blogHref && (
          <Link href={blogHref} className="text-sm text-muted hover:text-foreground">
            블로그
          </Link>
        )}
      </header>

      <section className="mx-auto max-w-2xl px-6 pb-16 pt-10 sm:pt-20">
        {T({ path: "hero.headline", value: hero.headline, as: "h1", className: "text-[2.75rem] font-semibold leading-[1.06] tracking-tight text-balance sm:text-[3.75rem]" })}
        {T({ path: "hero.shortDescription", value: hero.shortDescription, as: "p", className: "mt-8 text-xl leading-relaxed text-muted text-pretty" })}
        <a href="#contact" className="mt-8 inline-block border-b-2 border-primary pb-0.5 font-medium text-primary">
          {T({ path: "hero.ctaLabel", value: hero.ctaLabel || "문의하기", as: "span" })}
        </a>
        {(hero.image || editable) && (
          <div className="relative mt-12 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border bg-primary-soft">
            {Img({ path: "hero.image", value: hero.image, kind: "cover" })}
          </div>
        )}
      </section>

      <div className="mx-auto max-w-2xl px-6">
        <hr className="border-border" />
      </div>

      <section id="story" className="mx-auto max-w-2xl px-6 py-16">
        {T({ path: "story.title", value: story.title, as: "h2", className: "eyebrow mb-6 block" })}
        {T({ path: "story.body", value: story.body, as: "p", className: "whitespace-pre-wrap text-lg leading-[1.9] text-foreground/85" })}
      </section>

      <div className="mx-auto max-w-2xl px-6">
        <hr className="border-border" />
      </div>

      <section className="mx-auto max-w-2xl px-6 py-16">
        {T({ path: "offers.title", value: offers.title, as: "h2", className: "eyebrow mb-8 block" })}
        <div className="space-y-8">
          {offers.items.map((item, i) => (
            <div key={i} className="flex gap-6">
              <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                {(item.image || editable) && (
                  <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-xl border border-border">
                    {Img({ path: `offers.items.${i}.image`, value: item.image })}
                  </div>
                )}
                {T({ path: `offers.items.${i}.title`, value: item.title, as: "h3", className: "text-xl font-semibold tracking-tight" })}
                {T({ path: `offers.items.${i}.description`, value: item.description, as: "p", className: "mt-1 leading-relaxed text-muted" })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-6">
        <hr className="border-border" />
      </div>

      <section className="mx-auto max-w-2xl px-6 py-16">
        {T({ path: "whyChooseUs.title", value: whyChooseUs.title, as: "h2", className: "eyebrow mb-8 block" })}
        <div className="space-y-6">
          {whyChooseUs.items.map((item, i) => (
            <div key={i}>
              {T({ path: `whyChooseUs.items.${i}.title`, value: item.title, as: "h3", className: "text-lg font-semibold" })}
              {T({ path: `whyChooseUs.items.${i}.description`, value: item.description, as: "p", className: "mt-1 leading-relaxed text-muted" })}
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-6">
        <hr className="border-border" />
      </div>

      <section id="contact" className="mx-auto max-w-2xl px-6 py-16">
        <h2 className="eyebrow mb-8 block">Contact</h2>
        <div className="space-y-2 text-foreground/85">
          {CONTACT.map(([key, label]) =>
            editable || contact[key] ? (
              <p key={key}>
                <span className="mr-2 font-medium text-muted">{label}</span>
                {T({ path: `contact.${key}`, value: contact[key], as: "span", placeholder: label })}
              </p>
            ) : null,
          )}
        </div>
      </section>

      <footer className="mx-auto max-w-2xl px-6 py-10 text-sm text-muted">
        {hero.businessName} · © {new Date().getFullYear()} · Powered by STORYUP
      </footer>
    </div>
  );
}
