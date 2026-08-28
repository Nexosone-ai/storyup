import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedSite, getPublishedPost } from "@/lib/queries";
import { renderMarkdown } from "@/utils/markdown";
import { BlogCover } from "@/components/blog/BlogCover";
import { buildSeo } from "@/utils/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) return { title: "글을 찾을 수 없습니다" };
  const post = await getPublishedPost(site.business.id, postSlug);
  if (!post) return { title: "글을 찾을 수 없습니다" };

  return buildSeo({
    title: post.seo_title || post.title,
    description: post.seo_description || post.summary,
    keywords: post.keywords,
    path: `/site/${slug}/blog/${postSlug}`,
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}) {
  const { slug, postSlug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) notFound();
  const post = await getPublishedPost(site.business.id, postSlug);
  if (!post) notFound();

  const html = await renderMarkdown(post.content ?? "");
  const name = site.website.content.hero?.businessName ?? site.business.name;

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-5">
          <Link href={`/site/${slug}`} className="font-bold tracking-tight">
            {name}
          </Link>
          <Link href={`/site/${slug}/blog`} className="text-sm text-muted">
            ← 블로그
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-5 py-12">
        <p className="text-sm text-muted">{fmtDate(post.published_at)}</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        {post.summary && (
          <p className="mt-4 text-lg text-muted">{post.summary}</p>
        )}
        {post.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- 원격 스토리지 URL, 크기 고정 컨테이너
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="mt-8 aspect-[16/7] w-full rounded-2xl object-cover"
          />
        ) : (
          <BlogCover
            title={post.title}
            seed={post.slug}
            label={post.keywords[0] ? `#${post.keywords[0]}` : undefined}
            showTitle={false}
            className="mt-8 aspect-[16/7] w-full rounded-2xl"
          />
        )}
        <div
          className="prose mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {post.keywords.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6">
            {post.keywords.map((k) => (
              <span
                key={k}
                className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted"
              >
                #{k}
              </span>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
