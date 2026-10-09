import {
  SITE_SECTION_TYPES,
  type SiteSection,
  type SiteSectionType,
  type SitePage,
} from "@/types/domain";
import { slugify } from "@/utils/slug";

/**
 * AI가 생성한 "풍부한 홈페이지" 섹션 배열을 안전하게 정규화한다.
 * - 알 수 없는 type 제거, 항목 수 상한, 문자열 트림, 빈 섹션 제거.
 * - 저장/렌더 전에 항상 통과시켜 깨진 JSON이 레이아웃을 망가뜨리지 않게 한다.
 */

const MAX_SECTIONS = 10;
const MAX_ITEMS = 8;
const str = (v: unknown, max = 600): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const KNOWN = new Set<SiteSectionType>(SITE_SECTION_TYPES);

export function normalizeSiteSections(raw: unknown): SiteSection[] {
  const list = arr(raw).slice(0, MAX_SECTIONS);
  const out: SiteSection[] = [];

  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const type = o.type as SiteSectionType;
    if (!KNOWN.has(type)) continue;
    const title = str(o.title, 120);
    const subtitle = str(o.subtitle, 240) || undefined;
    const items = arr(o.items).slice(0, MAX_ITEMS);

    switch (type) {
      case "features": {
        const its = items
          .map((i) => {
            const x = (i ?? {}) as Record<string, unknown>;
            return { title: str(x.title, 120), description: str(x.description) };
          })
          .filter((i) => i.title || i.description);
        if (its.length) out.push({ type, title, subtitle, items: its });
        break;
      }
      case "pricing": {
        const its = items
          .map((i) => {
            const x = (i ?? {}) as Record<string, unknown>;
            return {
              name: str(x.name, 80),
              price: str(x.price, 60),
              description: str(x.description, 240) || undefined,
              features: arr(x.features)
                .map((f) => str(f, 120))
                .filter(Boolean)
                .slice(0, 10),
              highlighted: x.highlighted === true,
            };
          })
          .filter((i) => i.name || i.price);
        if (its.length) out.push({ type, title, subtitle, items: its });
        break;
      }
      case "steps": {
        const its = items
          .map((i) => {
            const x = (i ?? {}) as Record<string, unknown>;
            return { title: str(x.title, 120), description: str(x.description) };
          })
          .filter((i) => i.title || i.description);
        if (its.length) out.push({ type, title, subtitle, items: its });
        break;
      }
      case "faq": {
        const its = items
          .map((i) => {
            const x = (i ?? {}) as Record<string, unknown>;
            return { q: str(x.q, 200), a: str(x.a, 1200) };
          })
          .filter((i) => i.q);
        if (its.length) out.push({ type, title, subtitle, items: its });
        break;
      }
      case "testimonials": {
        const its = items
          .map((i) => {
            const x = (i ?? {}) as Record<string, unknown>;
            return {
              quote: str(x.quote, 500),
              author: str(x.author, 80),
              role: str(x.role, 80) || undefined,
            };
          })
          .filter((i) => i.quote);
        if (its.length) out.push({ type, title, subtitle, items: its });
        break;
      }
      case "stats": {
        const its = items
          .map((i) => {
            const x = (i ?? {}) as Record<string, unknown>;
            return { value: str(x.value, 40), label: str(x.label, 80) };
          })
          .filter((i) => i.value || i.label);
        if (its.length) out.push({ type, title: title || undefined, items: its });
        break;
      }
      case "cta": {
        if (title || str(o.body))
          out.push({
            type,
            title,
            body: str(o.body, 400) || undefined,
            ctaLabel: str(o.ctaLabel, 40) || undefined,
          });
        break;
      }
      case "richText": {
        const body = str(o.body, 4000);
        if (title || body) out.push({ type, title, body });
        break;
      }
    }
  }
  return out;
}

const MAX_PAGES = 5;
const RESERVED_SLUGS = new Set([
  "",
  "blog",
  "ads.txt",
  "sitemap.xml",
  "robots.txt",
  "admin",
  "api",
]);

/**
 * AI가 생성한 멀티페이지(pages[])를 안전하게 정규화한다.
 * - slug: 영문 slug 우선 → 비면 navLabel → page-N, 예약어/중복 회피.
 * - 각 페이지 sections는 normalizeSiteSections 재사용, 내용 없으면 제외.
 */
export function normalizeSitePages(raw: unknown): SitePage[] {
  const list = arr(raw).slice(0, MAX_PAGES);
  const out: SitePage[] = [];
  const used = new Set<string>();

  list.forEach((r, i) => {
    if (!r || typeof r !== "object") return;
    const o = r as Record<string, unknown>;
    const navLabel = str(o.navLabel, 40) || str(o.title, 40);

    let slug = slugify(str(o.slug, 48)) || slugify(navLabel) || `page-${i + 1}`;
    if (RESERVED_SLUGS.has(slug)) slug = `page-${i + 1}`;
    let uniq = slug;
    let k = 2;
    while (used.has(uniq)) uniq = `${slug}-${k++}`;
    slug = uniq;

    const sections = normalizeSiteSections(o.sections);

    const h = (o.hero ?? {}) as Record<string, unknown>;
    const headline = str(h.headline, 160);
    const shortDescription = str(h.shortDescription, 400);
    const hero =
      headline || shortDescription
        ? {
            headline,
            shortDescription: shortDescription || undefined,
            ctaLabel: str(h.ctaLabel, 40) || undefined,
          }
        : undefined;

    // 섹션도 히어로도 없으면 의미 없는 페이지 — 제외
    if (!sections.length && !hero) return;

    used.add(slug);
    out.push({
      id: `pg_${Date.now().toString(36)}${i}`,
      slug,
      navLabel: navLabel || slug,
      showInNav: o.showInNav !== false,
      hero,
      sections,
    });
  });

  return out;
}
