import type { SiteSectionPost } from "@/components/website/templates/BlogPreview";

/**
 * 블로그 연결 블록의 "추상 바인딩 규칙" — 디자인과 분리된 데이터 연결만 저장한다.
 * 실제 글은 저장하지 않고, 공개된 글 목록(런타임 조회)에 이 규칙을 적용해 고른다.
 * 판매 템플릿에도 이 규칙만 들어가 구매자 자신의 블로그로 연결된다(판매자 글 미복사).
 */
export type BlogSource = "latest" | "category" | "manual";
export type BlogSort = "recent" | "oldest";

export interface BlogBinding {
  /** 글 선택 방식: 최신 / 카테고리 / 수동 선택. */
  source?: BlogSource;
  /** source=category일 때 필터할 카테고리(비면 전체). */
  category?: string;
  /** source=manual일 때 고를 글 slug(이 순서 유지). */
  slugs?: string[];
  /** 항상 맨 앞에 고정할 글 slug(latest/category에서). */
  pinnedSlugs?: string[];
  /** 제외할 글 slug(중복 방지·특정 글 숨김). */
  excludeSlugs?: string[];
  /** 최대 글 수(기본 6). */
  count?: number;
  /** 정렬(기본 recent). manual은 slugs 순서를 우선한다. */
  sort?: BlogSort;
}

const DEFAULT_COUNT = 6;

const byRecent = (a: SiteSectionPost, b: SiteSectionPost) =>
  (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

/**
 * 공개된 글 목록(posts, 이미 published만)에 바인딩 규칙을 적용해 표시할 글을 고른다.
 * 순수함수 — DB 접근 없음. 호출부가 사업장의 공개 글을 한 번 조회해 넘긴다.
 * 초안·예약·타 사업장 글은 애초에 posts에 없다(호출부 보장).
 */
export function resolveBlogBlock(
  binding: BlogBinding | undefined | null,
  posts: SiteSectionPost[],
): SiteSectionPost[] {
  const b = binding ?? {};
  const source = b.source ?? "latest";
  const exclude = new Set(b.excludeSlugs ?? []);
  const count =
    Number.isFinite(b.count) && (b.count ?? 0) > 0 ? Math.trunc(b.count!) : DEFAULT_COUNT;

  const bySlug = new Map(posts.map((p) => [p.slug, p]));

  if (source === "manual") {
    // 지정한 slug 순서대로, 존재하고 제외되지 않은 글만.
    const picked: SiteSectionPost[] = [];
    for (const slug of b.slugs ?? []) {
      const p = bySlug.get(slug);
      if (p && !exclude.has(slug)) picked.push(p);
    }
    return picked.slice(0, count);
  }

  // latest / category 공통: 후보군 → 정렬 → 고정글 우선 → 개수.
  let pool = posts.filter((p) => !exclude.has(p.slug));
  if (source === "category" && b.category)
    pool = pool.filter((p) => (p.category ?? "") === b.category);

  pool = [...pool].sort(byRecent);
  if (b.sort === "oldest") pool.reverse();

  const pinnedSet = new Set(b.pinnedSlugs ?? []);
  if (pinnedSet.size > 0) {
    const pinned = (b.pinnedSlugs ?? [])
      .map((s) => bySlug.get(s))
      .filter((p): p is SiteSectionPost => !!p && !exclude.has(p.slug));
    const rest = pool.filter((p) => !pinnedSet.has(p.slug));
    pool = [...pinned, ...rest];
  }

  return pool.slice(0, count);
}
