import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getPublishedSite,
  getPublishedPosts,
  getBlogEngagement,
  getUser,
} from "@/lib/queries";
import {
  siteLang,
  SiteLogo,
  PoweredByStoryup,
} from "@/components/website/templates/shared";
import { BlogCover } from "@/components/blog/BlogCover";
import { TrackPageView } from "@/components/site/TrackPageView";
import { buildSeo } from "@/utils/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  const name = site?.website.content.hero?.businessName ?? "블로그";
  return buildSeo({ title: `${name} 블로그`, path: `/site/${slug}/blog` });
}

function fmtDate(iso: string | null, ko: boolean): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicBlogListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ menu?: string }>;
}) {
  const { slug } = await params;
  const { menu } = await searchParams;
  const site = await getPublishedSite(slug);
  if (!site) notFound();

  const allPosts = await getPublishedPosts(site.business.id);
  const categories = [
    ...new Set(allPosts.map((p) => p.category).filter(Boolean)),
  ] as string[];
  const active = menu && categories.includes(menu) ? menu : null;
  const posts = active
    ? allPosts.filter((p) => p.category === active)
    : allPosts;
  // 각 글의 댓글·좋아요 수 (카드에 표시)
  const engagement = await getBlogEngagement(posts.map((p) => p.id));
  const name = site.website.content.hero?.businessName ?? site.business.name;
  const logo = site.website.content.hero?.logo;
  // 사이트 콘텐츠 언어에 맞춰 크롬 문구를 고른다
  const ko = siteLang(site.website.content) === "ko";
  // 사이트 주인이 볼 때만 헤더에 "글쓰기" 바로가기를 노출한다.
  const viewer = await getUser();
  const writeHref =
    viewer && viewer.id === site.business.user_id
      ? `/business/${site.business.id}/blog/new`
      : null;

  return (
    <div className="min-h-dvh bg-white">
      <TrackPageView slug={slug} />
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Link
            href={`/site/${slug}`}
            className="flex min-w-0 items-center gap-2 font-bold tracking-tight"
          >
            <SiteLogo
              src={logo}
              fallback={site.website.content.hero?.image}
              className="h-7 max-w-28"
              fallbackClassName="size-7"
            />
            <span className="truncate">{name}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            {writeHref && (
              <Link
                href={writeHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                {ko ? "글쓰기" : "New post"}
              </Link>
            )}
            <Link href={`/site/${slug}`} className="text-sm text-muted">
              {ko ? "← 홈으로" : "← Home"}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="mb-8 text-3xl font-bold tracking-tight">
          {ko ? "블로그" : "Blog"}
        </h1>

        {categories.length > 0 && (
          <nav className="mb-8 flex flex-wrap gap-2">
            <Link
              href={`/site/${slug}/blog`}
              className={
                active === null
                  ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
                  : "rounded-full border border-border px-4 py-1.5 text-sm text-muted hover:text-foreground"
              }
            >
              {ko ? "전체" : "All"}
            </Link>
            {categories.map((c) => (
              <Link
                key={c}
                href={`/site/${slug}/blog?menu=${encodeURIComponent(c)}`}
                className={
                  active === c
                    ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
                    : "rounded-full border border-border px-4 py-1.5 text-sm text-muted hover:text-foreground"
                }
              >
                {c}
              </Link>
            ))}
          </nav>
        )}

        {posts.length === 0 ? (
          <p className="text-muted">
            {ko ? "아직 게시된 글이 없습니다." : "No posts published yet."}
          </p>
        ) : (
          <ul className="space-y-6">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/site/${slug}/blog/${post.slug}`}
                  className="group block rounded-2xl border border-border p-6 transition hover:border-primary/40"
                >
                  {post.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 원격 스토리지 URL, 크기 고정 컨테이너
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="mb-4 aspect-[16/6] w-full rounded-xl object-cover"
                    />
                  ) : (
                    <BlogCover
                      title={post.title}
                      seed={post.slug}
                      label={post.keywords[0] ? `#${post.keywords[0]}` : undefined}
                      showTitle={false}
                      className="mb-4 aspect-[16/6] w-full rounded-xl"
                    />
                  )}
                  <p className="text-xs text-muted">
                    {post.category && (
                      <span className="mr-2 font-medium text-primary">
                        {post.category}
                      </span>
                    )}
                    {fmtDate(post.published_at, ko)}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold group-hover:text-primary">
                    {post.title}
                  </h2>
                  {post.summary && (
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {post.summary}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l1.7 1.7L12 21.5l7.1-7.1 1.7-1.7a5 5 0 0 0 0-7.1Z" />
                      </svg>
                      <span className="tnum">
                        {engagement.get(post.id)?.likes ?? 0}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9.5 9.5 0 0 1-4-.9L3 20l1.4-4.5A8.5 8.5 0 1 1 21 11.5Z" />
                      </svg>
                      <span className="tnum">
                        {engagement.get(post.id)?.comments ?? 0}
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-8 text-sm text-muted">
          © {new Date().getFullYear()} {name} ·{" "}
          <PoweredByStoryup lang={ko ? "ko" : "en"} />
        </div>
      </footer>
    </div>
  );
}
