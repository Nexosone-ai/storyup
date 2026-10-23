import { Fragment, type ReactNode } from "react";
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
import { CardNewsSlider } from "@/components/marketing/CardNewsSlider";
import { BannerStrip } from "./BannerView";
import { orderedLandingKeys } from "./landingOrder";
import type { LandingSectionKey, WebsiteContent } from "@/types/domain";

/** 랜딩 배너 섹션 — placement="landing" 배너를 순서대로. */
function LandingBannerBlock({ content }: { content: WebsiteContent }) {
  const list = (content.banners ?? []).filter((b) => b.placement === "landing");
  if (list.length === 0) return null;
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <BannerStrip banners={content.banners} placement="landing" />
      </div>
    </section>
  );
}

/**
 * 메인 섹션을 content.sectionOrder 순서대로 렌더한다. blocks에서 각 키의 노드를 꺼내
 * 순서대로 배치(숨김 제외). 템플릿은 story/offers/whyChooseUs 등 자기 블록만 넘기면 된다.
 */
export function LandingSections({
  content,
  blocks,
}: {
  content: WebsiteContent;
  blocks: Partial<Record<LandingSectionKey, ReactNode>>;
}) {
  return (
    <>
      {orderedLandingKeys(content).map((k) => (
        <Fragment key={k}>
          {k === "banner" ? (
            <LandingBannerBlock content={content} />
          ) : (
            (blocks[k] ?? null)
          )}
        </Fragment>
      ))}
    </>
  );
}

/**
 * 메인 랜딩의 공유 하단 블록 — 갤러리·최신글·지도·문의·푸터.
 * 순서 재배치(landingOrder)를 위해 LowerSections에서 블록 단위로 분리했다.
 * 각 블록은 내용이 없으면 null을 렌더한다. tone/heading으로 템플릿 톤에 맞춘다.
 */
type Shared = Pick<
  TemplateProps,
  | "content"
  | "T"
  | "Gallery"
  | "blogHref"
  | "latestPosts"
  | "cards"
  | "editable"
  | "siteSlug"
> & { tone?: "default" | "soft" | "dark"; heading?: string };

const HEADING_DEFAULT = "font-semibold tracking-tight";

export function GalleryBlock({
  content,
  Gallery,
  editable,
  heading = HEADING_DEFAULT,
}: Shared) {
  const gallery = content.gallery ?? [];
  if (gallery.length === 0 && !editable) return null;
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <h2 className={`mb-8 text-center text-2xl ${heading}`}>Gallery</h2>
        {Gallery(gallery)}
      </div>
    </section>
  );
}

export function BlogBlock({
  content,
  blogHref,
  latestPosts,
  heading = HEADING_DEFAULT,
}: Shared) {
  if (!blogHref || !latestPosts || latestPosts.length === 0) return null;
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className={`text-2xl ${heading}`}>{L.latestPosts}</h2>
          <Link href={blogHref} className="text-sm font-medium text-primary">
            {L.viewAll}
          </Link>
        </div>
        <BlogPreviewCards posts={latestPosts} blogHref={blogHref} lang={lang} />
      </div>
    </section>
  );
}

export function CardsBlock({
  content,
  cards,
  heading = HEADING_DEFAULT,
}: Shared) {
  if (!cards || cards.length === 0) return null;
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <h2 className={`mb-8 text-2xl ${heading}`}>{L.cardNews}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-border bg-white"
            >
              <CardNewsSlider item={item} />
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <Link
                  href={item.href}
                  className="shrink-0 text-xs font-medium text-primary"
                >
                  {L.openShare}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MapBlock({
  content,
  T,
  editable,
  heading = HEADING_DEFAULT,
}: Shared) {
  const { contact } = content;
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  // 주소가 없으면 공개 사이트에선 숨긴다. 단, 편집기에선 주소를 입력할 수 있게 보여준다.
  if (!contact.address && !editable) return null;
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <h2 className={`mb-6 text-2xl ${heading}`}>{L.directions}</h2>
        {editable && (
          <div className="mb-4 rounded-xl border border-dashed border-border bg-surface-muted/40 p-4">
            <label className="mb-1 block text-xs font-medium text-muted">
              {lang === "ko" ? "주소" : "Address"}
            </label>
            {T({
              path: "contact.address",
              value: contact.address ?? "",
              as: "span",
              placeholder:
                lang === "ko" ? "예: 서울시 강남구 테헤란로 123" : "e.g. 123 Main St, Seoul",
              className:
                "inline-block min-w-64 rounded-md border border-border bg-white px-2 py-1 text-sm",
            })}
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {lang === "ko"
                ? "주소를 입력하면 공개 사이트에 지도가 표시돼요. 비어 있으면 '오시는 길'은 숨겨집니다. 변경 후 '저장'을 눌러주세요."
                : "Enter an address to show the map on your public site. Press Save to apply."}
            </p>
          </div>
        )}
        {contact.address ? <SiteMap address={contact.address} lang={lang} /> : null}
      </div>
    </section>
  );
}

export function ContactBlock({
  content,
  T,
  editable,
  siteSlug,
  tone = "default",
  heading = HEADING_DEFAULT,
}: Shared) {
  const { contact } = content;
  const lang = siteLang(content);
  const L = SITE_UI[lang];
  const showInquiry = !!siteSlug || !!editable;
  const showContact =
    showInquiry || CONTACT_FIELDS.some(([key]) => !!contact[key]);
  if (!showContact) return null;
  const band =
    tone === "dark" ? "bg-foreground text-white" : "bg-surface-muted/50";
  return (
    <section id="contact" className={band}>
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
  );
}

export function FooterBlock({ content }: Pick<TemplateProps, "content">) {
  const lang = siteLang(content);
  return (
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
  );
}
