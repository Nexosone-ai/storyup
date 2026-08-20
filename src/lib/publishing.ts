import { createClient } from "@/lib/supabase/server";
import type { ExportablePost } from "@/utils/publishExport";

export interface ConnectionRow {
  channel: string;
  account_label: string | null;
  connected: boolean;
}

export interface PublishPost extends ExportablePost {
  id: string;
  status: string;
}

export interface ScheduleRow {
  id: string;
  blog_post_id: string | null;
  channel: string;
  scheduled_at: string;
  status: string;
}

export interface PublishingData {
  connections: ConnectionRow[];
  posts: PublishPost[];
  schedules: ScheduleRow[];
}

export async function getPublishingData(
  businessId: string,
): Promise<PublishingData> {
  const supabase = await createClient();
  const [conns, posts, schedules] = await Promise.all([
    supabase
      .from("blog_connections")
      .select("channel,account_label,connected")
      .eq("business_id", businessId),
    supabase
      .from("blog_posts")
      .select(
        "id,title,slug,status,content,summary,keywords,seo_title,seo_description",
      )
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("publish_schedules")
      .select("id,blog_post_id,channel,scheduled_at,status")
      .eq("business_id", businessId)
      .order("scheduled_at", { ascending: true }),
  ]);

  return {
    connections: conns.data ?? [],
    posts: (posts.data ?? []) as PublishPost[],
    schedules: schedules.data ?? [],
  };
}
