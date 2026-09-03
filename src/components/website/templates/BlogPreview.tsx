import Link from "next/link";
import { BlogCover } from "@/components/blog/BlogCover";
import type { SiteLang } from "./shared";

/** 랜딩페이지의 최신 블로그 글 카드에 필요한 최소 필드. */
export interface SitePostPreview {
  slug: string;
  title: string;
  summary: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  keyword?: string;
}

function fmtDate(iso: string | null, ko: boolean): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * 랜딩페이지 하단의 "최신 블로그 글" 섹션 본문 (제목/컨테이너는 템플릿이 감싼다).
 * 카드를 클릭하면 해당 글로 이동한다. 세 템플릿 공용.
 */
export function BlogPreviewCards({
  posts,
  blogHref,
  lang,
  narrow = false,
}: {
  posts: SitePostPreview[];
  blogHref: string;
  lang: SiteLang;
  narrow?: boolean;
}) {
  const ko = lang === "ko";
  return (
    <div className={narrow ? "space-y-6" : "grid gap-5 md:grid-cols-3"}>
      {posts.map((post) => (
        <Link
          key={post.slug}
          href={`${blogHref}/${post.slug}`}
          className="group block overflow-hidden rounded-2xl border border-border bg-white transition hover:border-primary/40"
        >
          {post.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 원격 스토리지 URL, 크기 고정 컨테이너
            <img
              src={post.coverImageUrl}
              alt={post.title}
              className="aspect-[16/9] w-full border-b border-border object-cover"
            />
          ) : (
            <BlogCover
              title={post.title}
              seed={post.slug}
              label={post.keyword ? `#${post.keyword}` : undefined}
              showTitle={false}
              className="aspect-[16/9] w-full border-b border-border"
            />
          )}
          <div className="p-5">
            <p className="text-xs text-muted">
              {fmtDate(post.publishedAt, ko)}
            </p>
            <h3 className="mt-1 font-semibold leading-snug group-hover:text-primary">
              {post.title}
            </h3>
            {post.summary && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
                {post.summary}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
