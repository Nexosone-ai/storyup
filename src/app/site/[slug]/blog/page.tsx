import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedSite, getPublishedPosts } from "@/lib/queries";
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

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicBlogListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) notFound();

  const posts = await getPublishedPosts(site.business.id);
  const name = site.website.content.hero?.businessName ?? site.business.name;

  return (
    <div className="min-h-dvh bg-white">
      <TrackPageView slug={slug} />
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Link href={`/site/${slug}`} className="font-bold tracking-tight">
            {name}
          </Link>
          <Link href={`/site/${slug}`} className="text-sm text-muted">
            ← 홈으로
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="mb-8 text-3xl font-bold tracking-tight">블로그</h1>

        {posts.length === 0 ? (
          <p className="text-muted">아직 게시된 글이 없습니다.</p>
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
                    {fmtDate(post.published_at)}
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
