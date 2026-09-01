import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const all = likes ?? [];
  const allComments = comments ?? [];
  return list.map((p) => {
    const forPost = all.filter((l) => l.post_id === p.id);
    return {
      id: p.id,
      content: p.content,
      authorName: "author_name" in p ? (p.author_name as string) : null,
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
