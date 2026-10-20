import Link from "next/link";
import { BlogCover } from "@/components/blog/BlogCover";
import { RelativeTime } from "@/components/ui/RelativeTime";
import type { SiteLang } from "./shared";
import type { SiteSectionPost } from "./BlogPreview";
import { BlogPreviewCards } from "./BlogPreview";
import type { BlogLayout } from "@/types/domain";

/**
 * 블로그 연결 섹션의 '비균일' 레이아웃 렌더러 — 같은 데이터(resolveBlogBlock 결과)를
 * spotlight/feature/magazine/list/cards 로 다르게 표현한다. 서버 안전(정적 Link).
 * 글/이미지가 없어도 자연스럽게 보이도록 폴백(BlogCover)·빈 상태를 처리한다.
 */

function Cover({
  post,
  className,
}: {
  post: SiteSectionPost;
  className: string;
}) {
  if (post.coverImageUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 원격 스토리지 URL, 고정 컨테이너
      <img src={post.coverImageUrl} alt={post.title} className={`${className} object-cover`} />
    );
  return (
    <BlogCover
      title={post.title}
      seed={post.slug}
      label={post.keyword ? `#${post.keyword}` : undefined}
      showTitle={false}
      className={className}
    />
  );
}

function Meta({ post, ko }: { post: SiteSectionPost; ko: boolean }) {
  return (
    <p className="flex items-center gap-2 text-xs text-muted">
      {post.category && (
        <span className="rounded-full bg-primary-soft px-2 py-0.5 font-medium text-primary">
          {post.category}
        </span>
      )}
      {post.publishedAt && <RelativeTime iso={post.publishedAt} ko={ko} />}
    </p>
  );
}

export function BlogSectionBlock({
  layout,
  posts,
  blogHref,
  lang = "ko",
}: {
  layout: BlogLayout;
  posts: SiteSectionPost[];
  blogHref: string;
  lang?: SiteLang;
}) {
  const ko = lang === "ko";
  if (posts.length === 0)
    return (
      <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted">
        {ko
          ? "표시할 블로그 글이 아직 없어요. 글을 발행하면 여기에 자동으로 나타납니다."
          : "No published posts yet — they appear here automatically once you publish."}
      </p>
    );

  const href = (p: SiteSectionPost) => `${blogHref}/${p.slug}`;

  if (layout === "cards")
    return <BlogPreviewCards posts={posts} blogHref={blogHref} lang={lang} />;

  if (layout === "list")
    return (
      <ul className="divide-y divide-border">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={href(p)} className="group flex items-center gap-4 py-5">
              <div className="min-w-0 flex-1">
                <Meta post={p} ko={ko} />
                <h3 className="mt-1 text-lg font-semibold leading-snug tracking-tight group-hover:text-primary sm:text-xl">
                  {p.title}
                </h3>
                {p.summary && (
                  <p className="mt-1 line-clamp-1 text-sm text-muted">{p.summary}</p>
                )}
              </div>
              <Cover
                post={p}
                className="hidden aspect-square w-20 shrink-0 rounded-xl border border-border sm:block"
              />
            </Link>
          </li>
        ))}
      </ul>
    );

  // spotlight — 대표 글 1개를 이미지·텍스트 교차로 크게.
  if (layout === "spotlight") {
    const lead = posts[0];
    const rest = posts.slice(1, 4);
    return (
      <div className="space-y-8">
        <Link
          href={href(lead)}
          className="group grid gap-6 overflow-hidden rounded-3xl border border-border bg-surface md:grid-cols-2"
        >
          <Cover post={lead} className="aspect-[4/3] w-full md:aspect-auto md:h-full" />
          <div className="flex flex-col justify-center p-7">
            <Meta post={lead} ko={ko} />
            <h3 className="mt-2 text-2xl font-bold leading-tight tracking-tight group-hover:text-primary sm:text-3xl">
              {lead.title}
            </h3>
            {lead.summary && (
              <p className="mt-3 line-clamp-3 text-muted">{lead.summary}</p>
            )}
            <span className="mt-4 text-sm font-semibold text-primary">
              {ko ? "자세히 읽기 →" : "Read more →"}
            </span>
          </div>
        </Link>
        {rest.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-3">
            {rest.map((p) => (
              <Link key={p.slug} href={href(p)} className="group block">
                <Cover
                  post={p}
                  className="aspect-[16/10] w-full rounded-2xl border border-border"
                />
                <div className="mt-3">
                  <Meta post={p} ko={ko} />
                  <h4 className="mt-1 font-semibold leading-snug group-hover:text-primary">
                    {p.title}
                  </h4>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // feature — 큰 글 1 + 작은 글 2 (좌:대형, 우:2단 스택).
  if (layout === "feature") {
    const lead = posts[0];
    const side = posts.slice(1, 3);
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Link
          href={href(lead)}
          className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface"
        >
          <Cover post={lead} className="aspect-[16/9] w-full" />
          <div className="p-6">
            <Meta post={lead} ko={ko} />
            <h3 className="mt-2 text-xl font-bold leading-tight group-hover:text-primary sm:text-2xl">
              {lead.title}
            </h3>
            {lead.summary && (
              <p className="mt-2 line-clamp-2 text-muted">{lead.summary}</p>
            )}
          </div>
        </Link>
        <div className="flex flex-col gap-6">
          {side.map((p) => (
            <Link
              key={p.slug}
              href={href(p)}
              className="group flex gap-4 overflow-hidden rounded-2xl border border-border bg-surface p-3"
            >
              <Cover
                post={p}
                className="aspect-square w-28 shrink-0 rounded-xl border border-border"
              />
              <div className="min-w-0 flex-1 py-1">
                <Meta post={p} ko={ko} />
                <h4 className="mt-1 line-clamp-2 font-semibold leading-snug group-hover:text-primary">
                  {p.title}
                </h4>
                {p.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{p.summary}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // magazine — 첫 글 대형(2열 차지) + 나머지 작은 그리드.
  const [first, ...others] = posts;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <Link
        href={href(first)}
        className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface sm:col-span-2 lg:row-span-2"
      >
        <Cover post={first} className="aspect-[16/9] w-full lg:aspect-[16/10]" />
        <div className="p-6">
          <Meta post={first} ko={ko} />
          <h3 className="mt-2 text-xl font-bold leading-tight group-hover:text-primary sm:text-2xl">
            {first.title}
          </h3>
          {first.summary && (
            <p className="mt-2 line-clamp-2 text-muted">{first.summary}</p>
          )}
        </div>
      </Link>
      {others.map((p) => (
        <Link
          key={p.slug}
          href={href(p)}
          className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface"
        >
          <Cover post={p} className="aspect-[16/10] w-full" />
          <div className="p-4">
            <Meta post={p} ko={ko} />
            <h4 className="mt-1 line-clamp-2 font-semibold leading-snug group-hover:text-primary">
              {p.title}
            </h4>
          </div>
        </Link>
      ))}
    </div>
  );
}
