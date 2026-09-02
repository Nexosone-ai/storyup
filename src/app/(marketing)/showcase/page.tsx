import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { SiteCard, PostCard, CardNewsCard } from "@/components/marketing/ShowcaseTabs";
import { toSiteItem, toPostItem, toCardItem } from "@/components/marketing/showcaseData";
import { getDict } from "@/lib/i18n";
import { getShowcaseSites, getShowcasePosts, getShowcaseCards } from "@/lib/queries";
import { cn } from "@/utils/cn";

export const metadata = {
  title: "스토리들",
  alternates: { canonical: "/showcase" },
};

export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab =
    tabParam === "blog" ? "blog" : tabParam === "cards" ? "cards" : "site";

  const { t } = await getDict();
  const L = t.landing;
  const [sites, posts, cards] = await Promise.all([
    getShowcaseSites(60),
    getShowcasePosts(60),
    getShowcaseCards(60),
  ]);

  const isEmpty =
    tab === "site"
      ? sites.length === 0
      : tab === "blog"
        ? posts.length === 0
        : cards.length === 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="flex-1 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-semibold uppercase tracking-wide">
              {L.showcaseT1}
              <span className="neon-text text-primary">{L.showcaseT2}</span>
            </h1>
            <p className="mt-3 text-muted">{L.showcaseSub}</p>
          </div>

          <div className="mb-10 flex items-center justify-center gap-2">
            {(
              [
                ["site", L.showcase.tabSites],
                ["blog", L.showcase.tabBlogs],
                ["cards", L.showcase.tabCards],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                href={`/showcase?tab=${key}`}
                className={cn(
                  "rounded-lg px-5 py-2 font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-[0.15em] transition-colors",
                  tab === key
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted hover:border-primary/50 hover:text-primary",
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          {isEmpty ? (
            <p className="py-16 text-center text-muted">{L.showcase.empty}</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tab === "site"
                ? sites.map((s) => {
                    const item = toSiteItem(s);
                    return <SiteCard key={item.href} item={item} />;
                  })
                : tab === "blog"
                  ? posts.map((p) => {
                      const item = toPostItem(p);
                      return <PostCard key={item.href} item={item} />;
                    })
                  : cards.map((c) => {
                      const item = toCardItem(c);
                      return <CardNewsCard key={item.id} item={item} />;
                    })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
