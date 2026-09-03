import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedSite, getPublishedPosts } from "@/lib/queries";
import { siteLang } from "@/components/website/templates/shared";
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
  const name = site.website.content.hero?.businessName ?? site.business.name;
  // 사이트 콘텐츠 언어에 맞춰 크롬 문구를 고른다
  const ko = siteLang(site.website.content) === "ko";

  return (
    <div className="min-h-dvh bg-white">
      <TrackPageView slug={slug} />
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Link href={`/site/${slug}`} className="font-bold tracking-tight">
            {name}
          </Link>
          <Link href={`/site/${slug}`} className="text-sm text-muted">
            {ko ? "← 홈으로" : "← Home"}
          </Link>
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
