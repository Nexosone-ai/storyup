import Link from "next/link";
import {
  CONTACT_FIELDS,
  ContactEntry,
  PoweredByStoryup,
  SITE_UI,
  SiteMap,
  siteLang,
  type TemplateProps,
} from "./shared";
import { BlogPreviewCards } from "./BlogPreview";
import { InquiryForm } from "@/components/site/InquiryForm";

/**
 * 템플릿 공통 하단 섹션 — 갤러리·블로그·지도·문의·푸터.
 * 상단(헤더·히어로·스토리·오퍼·강점)만 템플릿마다 다르게 디자인하고,
 * 거의 동일한 하단은 이 컴포넌트를 재사용한다. `tone`으로 배경만 살짝 바꾼다.
 */
export function LowerSections({
  content,
  T,
  Gallery,
  blogHref,
  latestPosts,
  editable,
  siteSlug,
  tone = "default",
  heading = "font-semibold tracking-tight",
}: Pick<
  TemplateProps,
  "content" | "T" | "Gallery" | "blogHref" | "latestPosts" | "editable" | "siteSlug"
> & {
  /** 섹션 구분 배경 톤 */
  tone?: "default" | "soft" | "dark";
  /** 섹션 제목 공통 클래스 (템플릿 타이포에 맞춤) */
  heading?: string;
}) {
  const { contact } = content;
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  const gallery = content.gallery ?? [];
  const showInquiry = !!siteSlug || !!editable;
  const showContact =
    showInquiry || CONTACT_FIELDS.some(([key]) => !!contact[key]);
  const band =
    tone === "dark"
      ? "bg-foreground text-white"
      : tone === "soft"
        ? "bg-surface-muted/50"
        : "";

  return (
    <>
      {(gallery.length > 0 || editable) && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-5 py-16">
            <h2 className={`mb-8 text-center text-2xl ${heading}`}>Gallery</h2>
            {Gallery(gallery)}
          </div>
        </section>
      )}

      {blogHref && latestPosts && latestPosts.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-5 py-16">
            <div className="mb-8 flex items-baseline justify-between">
              <h2 className={`text-2xl ${heading}`}>{L.latestPosts}</h2>
              <Link href={blogHref} className="text-sm font-medium text-primary">
                {L.viewAll}
              </Link>
            </div>
            <BlogPreviewCards
              posts={latestPosts}
              blogHref={blogHref}
              lang={lang}
            />
          </div>
        </section>
      )}

      {contact.address && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-5 py-16">
            <h2 className={`mb-6 text-2xl ${heading}`}>{L.directions}</h2>
            <SiteMap address={contact.address} lang={lang} />
          </div>
        </section>
      )}

      {showContact && (
        <section id="contact" className={band || "bg-surface-muted/50"}>
          <div className="mx-auto grid max-w-5xl items-start gap-10 px-5 py-16 md:grid-cols-2">
            <div>
              <h2 className={`text-2xl ${heading}`}>{L.inquire}</h2>
              <div
                className={`mt-6 grid gap-2 text-sm ${tone === "dark" ? "text-white/85" : "text-foreground/85"}`}
              >
                {CONTACT_FIELDS.map(([key, ko, en]) => (
                  <ContactEntry
                    key={key}
                    k={key}
                    label={lang === "en" ? en : ko}
                    value={contact[key] ?? ""}
                    T={T}
                    editable={editable}
                  />
                ))}
              </div>
            </div>
            {showInquiry && <InquiryForm slug={siteSlug} lang={lang} />}
          </div>
        </section>
      )}

      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-5xl px-5 py-8 text-center text-sm text-muted">
          <p>
            © {new Date().getFullYear()}{" "}
            <span className="px-2 font-semibold text-foreground">
              {content.hero.businessName}
            </span>
            · <PoweredByStoryup lang={lang} />
          </p>
        </div>
      </footer>
    </>
  );
}
