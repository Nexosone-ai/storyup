import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";

/**
 * SEO 검색 확인 — 이제껏 쓴 글·키워드를 구글/네이버에서 바로 검색하고,
 * 색인 여부(site:)를 확인할 수 있는 바로가기 링크 모음.
 * (검색 API 없이 링크만 제공 — 클릭 시 새 탭에서 실제 검색 결과가 열린다.)
 */

export interface SeoSearchPost {
  id: string;
  title: string;
  slug: string;
  keywords: string[];
  /** 공개 글 URL (색인 확인용). 없으면 색인 링크 생략. */
  url: string | null;
}

const google = (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const naver = (q: string) =>
  `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`;

function LinkChip({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-primary/50 hover:text-primary"
    >
      {children}
    </a>
  );
}

export function SeoSearchPanel({
  posts,
  ko,
}: {
  posts: SeoSearchPost[];
  ko: boolean;
}) {
  const keywords = [
    ...new Set(
      posts.flatMap((p) => p.keywords).map((k) => k.trim()).filter(Boolean),
    ),
  ].slice(0, 30);

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 font-semibold tracking-tight">
        <Icon.globe className="size-4 text-primary" />
        {ko ? "SEO 검색 확인 (구글·네이버)" : "SEO search check (Google·Naver)"}
      </h2>
      <p className="mb-5 text-sm text-muted">
        {ko
          ? "이제껏 쓴 글과 키워드를 구글·네이버에서 바로 검색해 실제 노출을 확인하세요. ‘색인 확인’은 글이 검색엔진에 등록됐는지 보여줘요."
          : "Search your posts and keywords on Google·Naver to see real exposure. ‘Index check’ shows whether a post is indexed."}
      </p>

      {posts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {ko
            ? "아직 발행된 글이 없어요. 글을 발행하면 여기서 검색 노출을 확인할 수 있어요."
            : "No published posts yet. Publish a post to check search exposure here."}
        </p>
      ) : (
        <>
          {keywords.length > 0 && (
            <div className="mb-6">
              <p className="mb-2.5 text-sm font-medium text-muted">
                {ko ? "키워드 검색" : "Keyword search"}
              </p>
              <ul className="space-y-2">
                {keywords.map((kw) => (
                  <li
                    key={kw}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2"
                  >
                    <span className="text-sm font-medium">{kw}</span>
                    <span className="flex gap-1.5">
                      <LinkChip href={google(kw)}>
                        {ko ? "구글" : "Google"}
                      </LinkChip>
                      <LinkChip href={naver(kw)}>
                        {ko ? "네이버" : "Naver"}
                      </LinkChip>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-2.5 text-sm font-medium text-muted">
              {ko ? "글 제목 검색 · 색인 확인" : "Post search · index check"}
            </p>
            <ul className="space-y-2.5">
              {posts.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.title}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <LinkChip href={google(p.title)}>
                      {ko ? "구글" : "Google"}
                    </LinkChip>
                    <LinkChip href={naver(p.title)}>
                      {ko ? "네이버" : "Naver"}
                    </LinkChip>
                    {p.url && (
                      <LinkChip href={google(`site:${p.url}`)}>
                        {ko ? "색인 확인" : "Index check"}
                      </LinkChip>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Card>
  );
}
