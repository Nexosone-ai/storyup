import "server-only";
import { createClient } from "@/lib/supabase/server";
import { siteUrl, siteBaseUrl } from "@/utils/seo";

/** 광고주가 공유 의뢰할 수 있는 자기 콘텐츠(발행 블로그 / 카드뉴스). */
export interface ShareableContent {
  contentType: "blog" | "card_news";
  refId: string;
  title: string;
  url: string;
  businessName: string;
}

/**
 * 로그인 사용자 본인의 공유 가능 콘텐츠 목록. 세션 RLS로 소유 비즈니스만 조회된다.
 * - 블로그: status='published' + 사이트 slug 있는 것만(공개 URL 생성 가능).
 * - 카드뉴스: marketing_contents(instagram_cards), 공개 /cards/{id}.
 */
export async function listMyShareableContent(
  userId: string,
): Promise<ShareableContent[]> {
  const supabase = await createClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", userId);
  const bizList = businesses ?? [];
  if (!bizList.length) return [];
  const bizIds = bizList.map((b) => b.id);
  const nameMap = new Map(bizList.map((b) => [b.id, b.name]));

  const [{ data: sites }, { data: posts }, { data: cards }] = await Promise.all([
    supabase
      .from("websites")
      .select("business_id, slug, status")
      .in("business_id", bizIds),
    supabase
      .from("blog_posts")
      .select("id, business_id, title, slug, status")
      .in("business_id", bizIds)
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    supabase
      .from("marketing_contents")
      .select("id, business_id, blog_post_id, created_at")
      .in("business_id", bizIds)
      .eq("platform", "instagram_cards")
      .order("created_at", { ascending: false }),
  ]);

  const slugMap = new Map(
    (sites ?? [])
      .filter((s) => s.status === "published" && s.slug)
      .map((s) => [s.business_id, s.slug as string]),
  );
  const postTitle = new Map(
    (posts ?? []).map((p) => [p.id, p.title as string]),
  );

  const out: ShareableContent[] = [];
  for (const p of posts ?? []) {
    const slug = slugMap.get(p.business_id);
    if (!slug) continue; // 발행 사이트 없으면 공개 URL 불가 → 제외
    out.push({
      contentType: "blog",
      refId: p.id,
      title: p.title,
      url: `${siteBaseUrl(null, slug)}/blog/${p.slug}`,
      businessName: nameMap.get(p.business_id) ?? "",
    });
  }
  for (const c of cards ?? []) {
    out.push({
      contentType: "card_news",
      refId: c.id,
      title: c.blog_post_id
        ? `카드뉴스 · ${postTitle.get(c.blog_post_id) ?? ""}`.trim()
        : "카드뉴스",
      url: `${siteUrl}/cards/${c.id}`,
      businessName: nameMap.get(c.business_id) ?? "",
    });
  }
  return out;
}

/** 콘텐츠 소유·공개 검증 후 공유용 URL·제목 반환(주문 생성 시 서버 신뢰). */
export async function resolveShareContent(
  userId: string,
  contentType: "blog" | "card_news",
  refId: string,
): Promise<{ url: string; title: string } | null> {
  const all = await listMyShareableContent(userId);
  const hit = all.find(
    (c) => c.contentType === contentType && c.refId === refId,
  );
  return hit ? { url: hit.url, title: hit.title } : null;
}
