import { createClient } from "@/lib/supabase/server";

export interface FeedPost {
  id: string;
  content: string;
  authorName: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
}

async function buildFeed(
  table: "story_connect_posts" | "real_talk_posts",
  likesTable: "story_connect_likes" | "real_talk_likes",
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

  const { data: likes } =
    ids.length > 0
      ? await supabase.from(likesTable).select("post_id,user_id").in("post_id", ids)
      : { data: [] as { post_id: string; user_id: string }[] };

  const all = likes ?? [];
  return list.map((p) => {
    const forPost = all.filter((l) => l.post_id === p.id);
    return {
      id: p.id,
      content: p.content,
      authorName: "author_name" in p ? (p.author_name as string) : null,
      createdAt: p.created_at,
      likeCount: forPost.length,
      likedByMe: !!user && forPost.some((l) => l.user_id === user.id),
      mine: !!user && p.user_id === user.id,
    };
  });
}

export function getStoryFeed() {
  return buildFeed("story_connect_posts", "story_connect_likes");
}

export function getRealTalkFeed() {
  return buildFeed("real_talk_posts", "real_talk_likes");
}
