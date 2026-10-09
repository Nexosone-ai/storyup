import type { SitePage, WebsiteContent } from "@/types/domain";
import {
  CONTACT_FIELDS,
  PoweredByStoryup,
  SiteLogo,
  siteLang,
  staticText,
  staticImage,
} from "./templates/shared";
import { SiteNav } from "./templates/SiteNav";
import { SiteSections } from "./templates/SiteSections";

/**
 * (프리미엄) 멀티페이지 — 홈 외 서브페이지 공개 렌더러.
 * 홈 템플릿과 같은 상단 nav(로고·메뉴)·푸터 틀에, 선택적 페이지 히어로 + 섹션을 그린다.
 * palette/font는 상위 layout.tsx가 이미 적용한다. (정적 렌더 — 편집은 대시보드에서.)
 */
export function SubPageRenderer({
  content,
  page,
  siteSlug,
  blogHref,
  editHref,
}: {
  content: WebsiteContent;
  page: SitePage;
  siteSlug: string;
  blogHref?: string;
  editHref?: string;
}) {
  const lang = siteLang(content);
  const { hero } = content;
  const showContact = CONTACT_FIELDS.some(([key]) => !!content.contact?.[key]);

  return (
    <div className="theme-editorial-light bg-white text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <a href={`/site/${siteSlug}`} className="flex min-w-0 items-center gap-2.5">
            <SiteLogo src={hero.logo} fallback={hero.image} />
            <span className="truncate font-bold tracking-tight">
              {hero.businessName}
            </span>
          </a>
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

      {page.hero && (page.hero.headline || page.hero.shortDescription) && (
        <section className="border-b border-border bg-surface-muted/40">
          <div className="mx-auto max-w-3xl px-5 py-20 text-center">
            {page.hero.headline && (
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {page.hero.headline}
              </h1>
            )}
            {page.hero.shortDescription && (
              <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-pretty text-muted">
                {page.hero.shortDescription}
              </p>
            )}
            {showContact && page.hero.ctaLabel && (
              <a
                href={`/site/${siteSlug}#contact`}
                className="mt-8 inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-xs"
              >
                {page.hero.ctaLabel}
              </a>
            )}
          </div>
        </section>
      )}

      <SiteSections sections={page.sections} T={staticText} Img={staticImage} />

      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-5xl px-5 py-8 text-center text-sm text-muted">
          <p>
            © {new Date().getFullYear()}{" "}
            <span className="px-2 font-semibold text-foreground">
              {hero.businessName}
            </span>
            · <PoweredByStoryup lang={lang} />
          </p>
        </div>
      </footer>
    </div>
  );
}
