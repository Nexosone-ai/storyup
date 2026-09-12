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
import { getDict, getLocale } from "@/lib/i18n";
import {
  getShowcaseSites,
  getShowcasePosts,
  getShowcaseCards,
  getBlogEngagement,
} from "@/lib/queries";
import { INDUSTRIES } from "@/types/domain";
import { cn } from "@/utils/cn";

export const metadata = {
  title: "스토리들",
  alternates: { canonical: "/showcase" },
};

export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; industry?: string }>;
}) {
  const { tab: tabParam, industry: industryParam } = await searchParams;
  const tab =
    tabParam === "blog" ? "blog" : tabParam === "cards" ? "cards" : "site";

  const { t } = await getDict();
  const ko = (await getLocale()) === "ko";
  const L = t.landing;
  const [allSites, allPosts, allCards] = await Promise.all([
    getShowcaseSites(60),
    getShowcasePosts(60),
    getShowcaseCards(60),
  ]);

  // 업종 필터 — 실제 콘텐츠(사업체)가 있는 업종만 칩으로 노출한다(없으면 필터 행 숨김).
  const presentIds = new Set<string>();
  for (const s of allSites) if (s.industry) presentIds.add(s.industry);
  for (const p of allPosts) if (p.industry) presentIds.add(p.industry);
  for (const c of allCards) if (c.industry) presentIds.add(c.industry);
  const industryChips = INDUSTRIES.filter((it) => presentIds.has(it.id));
  const activeIndustry =
    industryParam && presentIds.has(industryParam) ? industryParam : null;

  const sites = activeIndustry
    ? allSites.filter((s) => s.industry === activeIndustry)
    : allSites;
  const posts = activeIndustry
    ? allPosts.filter((p) => p.industry === activeIndustry)
    : allPosts;
  const cards = activeIndustry
    ? allCards.filter((c) => c.industry === activeIndustry)
    : allCards;

  const isEmpty =
    tab === "site"
      ? sites.length === 0
      : tab === "blog"
        ? posts.length === 0
        : cards.length === 0;

  // 블로그 탭: 조회수 1위에 인기글 뱃지, 최신 3개는 '최근 글'로 따로 묶는다.
  const engagement = await getBlogEngagement(posts.map((p) => p.post.id));
  const postItems = markHotPost(
    posts.map((p) => toPostItem(p, engagement)),
    L.showcase.popular,
  );
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

          {/* 업종 필터 — 콘텐츠가 있는 업종만, 탭 아래에 노출. 클릭하면 해당 업종만 보인다. */}
          {industryChips.length > 0 && (
            <div className="mb-10 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={`/showcase?tab=${tab}`}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  activeIndustry === null
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted hover:border-primary/50 hover:text-primary",
                )}
              >
                {ko ? "전체" : "All"}
              </Link>
              {industryChips.map((it) => (
                <Link
                  key={it.id}
                  href={`/showcase?tab=${tab}&industry=${it.id}`}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    activeIndustry === it.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted hover:border-primary/50 hover:text-primary",
                  )}
                >
                  {ko ? it.ko : it.en}
                </Link>
              ))}
            </div>
          )}

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
