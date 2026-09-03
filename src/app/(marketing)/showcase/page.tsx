import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { SiteCard, PostCard, CardNewsCard } from "@/components/marketing/ShowcaseTabs";
import {
  toSiteItem,
  toPostItem,
  toCardItem,
  markHotPost,
} from "@/components/marketing/showcaseData";
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

  // 블로그 탭: 조회수 1위에 인기글 뱃지, 최신 3개는 '최근 글'로 따로 묶는다.
  const postItems = markHotPost(posts.map(toPostItem), L.showcase.popular);
  const recentPosts = postItems.slice(0, 3);
  const restPosts = postItems.slice(3);

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
          ) : tab === "blog" ? (
            <div className="space-y-12">
              <section>
                <h2 className="mb-5 text-lg font-semibold tracking-tight">
                  {L.showcase.recent}
                </h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {recentPosts.map((item) => (
                    <PostCard key={item.href} item={item} />
                  ))}
                </div>
              </section>
              {restPosts.length > 0 && (
                <section>
                  <h2 className="mb-5 text-lg font-semibold tracking-tight">
                    {L.showcase.all}
                  </h2>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {restPosts.map((item) => (
                      <PostCard key={item.href} item={item} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tab === "site"
                ? sites.map((s) => {
                    const item = toSiteItem(s);
                    return <SiteCard key={item.href} item={item} />;
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
