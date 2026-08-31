import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { SiteCard, PostCard } from "@/components/marketing/ShowcaseTabs";
import { toSiteItem, toPostItem } from "@/components/marketing/showcaseData";
import { getDict } from "@/lib/i18n";
import { getShowcaseSites, getShowcasePosts } from "@/lib/queries";
import { cn } from "@/utils/cn";

export const metadata = { title: "포트폴리오" };

export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "blog" ? "blog" : "site";

  const { t } = await getDict();
  const L = t.landing;
  const [sites, posts] = await Promise.all([
    getShowcaseSites(60),
    getShowcasePosts(60),
  ]);
  const items =
    tab === "site" ? sites.map(toSiteItem) : posts.map(toPostItem);

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

          {items.length === 0 ? (
            <p className="py-16 text-center text-muted">{L.showcase.empty}</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tab === "site"
                ? sites.map((s) => {
                    const item = toSiteItem(s);
                    return <SiteCard key={item.href} item={item} />;
                  })
                : posts.map((p) => {
                    const item = toPostItem(p);
                    return <PostCard key={item.href} item={item} />;
                  })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
