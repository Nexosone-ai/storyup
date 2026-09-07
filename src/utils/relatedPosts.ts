import type { BlogPostRow } from "@/types/database";

/**
 * 관련 콘텐츠 선정 — 같은 비즈니스의 발행 글 중에서
 * 키워드 겹침(+3/개) > 카테고리 일치(+2) > 제목 단어 겹침(+1/개, 최대 3)으로
 * 점수를 매기고, 관련 글이 부족하면 최신 글로 채운다 (내부 링크 확보).
 */
export function pickRelatedPosts(
  current: BlogPostRow,
  all: BlogPostRow[],
  max = 4,
): BlogPostRow[] {
  const others = all.filter((p) => p.id !== current.id);
  if (others.length === 0) return [];

  const myKeywords = new Set(current.keywords.map((k) => k.trim()).filter(Boolean));
  const myTitleTokens = new Set(
    current.title.split(/\s+/).filter((t) => t.length >= 2),
  );

  const scored = others
    .map((p) => {
      let score = 0;
      for (const k of p.keywords) if (myKeywords.has(k.trim())) score += 3;
      if (current.category && p.category === current.category) score += 2;
      let titleHits = 0;
      for (const t of p.title.split(/\s+/))
        if (t.length >= 2 && myTitleTokens.has(t)) titleHits++;
      score += Math.min(titleHits, 3);
      return { p, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.p.published_at ?? "").localeCompare(a.p.published_at ?? ""),
    );

  const related = scored.filter((s) => s.score > 0).map((s) => s.p);
  if (related.length >= max) return related.slice(0, max);

  // 관련 글이 부족하면 최신 글로 채운다 — 그래도 내부 링크는 생긴다.
  const fill = scored
    .filter((s) => s.score === 0)
    .map((s) => s.p)
    .slice(0, max - related.length);
  return [...related, ...fill].slice(0, max);
}
