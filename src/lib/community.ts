import { createClient, createAdminClient } from "@/lib/supabase/server";

export interface FeedComment {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  mine: boolean;
}

export interface FeedPost {
  id: string;
  content: string;
  authorName: string | null;
  /** 작성자의 공개된 랜딩페이지 슬러그 — 이름 클릭 시 그 사업자 스토리로 이동 */
  authorSiteSlug: string | null;
  imageUrls: string[];
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
  comments: FeedComment[];
}

async function buildFeed(
  table: "story_connect_posts" | "real_talk_posts",
  likesTable: "story_connect_likes" | "real_talk_likes",
  postType: "story" | "realtalk",
): Promise<FeedPost[]> {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();

  // 커뮤니티는 공개 페이지에서도 보여야 하므로 읽기는 service role로 수행한다.
  const supabase = createAdminClient();

  const { data: posts } = await supabase
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  const list = posts ?? [];
  const ids = list.map((p) => p.id);

  const [{ data: likes }, { data: comments }] =
    ids.length > 0
      ? await Promise.all([
          supabase
            .from(likesTable)
            .select("post_id,user_id")
            .in("post_id", ids),
          supabase
            .from("community_comments")
            .select("*")
            .eq("post_type", postType)
            .in("post_id", ids)
            .order("created_at", { ascending: true }),
        ])
      : [
          { data: [] as { post_id: string; user_id: string }[] },
          { data: [] as never[] },
        ];

  // 스토리 게시판은 작성자 이름을 공개하므로, 이름 클릭 시 이동할
  // 작성자의 공개 랜딩페이지 슬러그를 함께 찾는다 (찐이야기는 익명이라 생략).
  const slugByUser = new Map<string, string>();
  if (postType === "story" && list.length > 0) {
    const userIds = [...new Set(list.map((p) => p.user_id as string))];
    const { data: bizs } = await supabase
      .from("businesses")
      .select("id, user_id")
      .in("user_id", userIds);
    const bizIds = (bizs ?? []).map((b) => b.id);
    if (bizIds.length > 0) {
      const { data: sites } = await supabase
        .from("websites")
        .select("business_id, slug, published_at")
        .in("business_id", bizIds)
        .eq("status", "published")
        .order("published_at", { ascending: false });
      const userByBiz = new Map((bizs ?? []).map((b) => [b.id, b.user_id]));
      for (const s of sites ?? []) {
        const uid = userByBiz.get(s.business_id);
        // 최신 공개 사이트 우선 (이미 최신순 정렬)
        if (uid && !slugByUser.has(uid)) slugByUser.set(uid, s.slug);
      }
    }
  }

  const all = likes ?? [];
  const allComments = comments ?? [];
  return list.map((p) => {
    const forPost = all.filter((l) => l.post_id === p.id);
    return {
      id: p.id,
      content: p.content,
      authorName: "author_name" in p ? (p.author_name as string) : null,
      authorSiteSlug: slugByUser.get(p.user_id as string) ?? null,
      imageUrls: "image_urls" in p ? ((p.image_urls as string[]) ?? []) : [],
      createdAt: p.created_at,
      likeCount: forPost.length,
      likedByMe: !!user && forPost.some((l) => l.user_id === user.id),
      mine: !!user && p.user_id === user.id,
      comments: allComments
        .filter((c) => c.post_id === p.id)
        .map((c) => ({
          id: c.id,
          content: c.content,
          authorName: c.author_name,
          createdAt: c.created_at,
          mine: !!user && c.user_id === user.id,
        })),
    };
  });
}

export function getStoryFeed() {
  return buildFeed("story_connect_posts", "story_connect_likes", "story");
}

export function getRealTalkFeed() {
  return buildFeed("real_talk_posts", "real_talk_likes", "realtalk");
}
