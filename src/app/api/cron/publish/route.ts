import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export const maxDuration = 60;

/**
 * 예약 발행 크론 (vercel.json crons).
 * status='draft' 이면서 scheduled_at 도래한 글을 published로 전환한다.
 * RLS를 우회해야 초안을 볼 수 있으므로 service-role 클라이언트를 쓴다.
 * Vercel Cron은 CRON_SECRET 설정 시 Authorization: Bearer 헤더를 자동 첨부한다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: due, error } = await admin
    .from("blog_posts")
    .select("id, business_id, slug")
    .eq("status", "draft")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", now)
    .limit(200);
  if (error) {
    console.error("[cron/publish] query failed", error.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  let published = 0;
  const webSlugCache = new Map<string, string | null>();

  for (const post of due ?? []) {
    const { error: upErr } = await admin
      .from("blog_posts")
      .update({ status: "published", published_at: now, scheduled_at: null })
      .eq("id", post.id)
      .eq("status", "draft"); // 경합 방지: 여전히 draft일 때만
    if (upErr) {
      console.error("[cron/publish] update failed", post.id, upErr.message);
      continue;
    }
    published++;

    // 공개 페이지 캐시 갱신
    let webSlug = webSlugCache.get(post.business_id);
    if (webSlug === undefined) {
      const { data: web } = await admin
        .from("websites")
        .select("slug")
        .eq("business_id", post.business_id)
        .maybeSingle();
      webSlug = web?.slug ?? null;
      webSlugCache.set(post.business_id, webSlug);
    }
    if (webSlug) {
      revalidatePath(`/site/${webSlug}`);
      revalidatePath(`/site/${webSlug}/blog`);
      revalidatePath(`/site/${webSlug}/blog/${post.slug}`);
    }
    revalidatePath(`/business/${post.business_id}/blog`);
  }
  revalidatePath("/sitemap.xml");

  const result = { checked: due?.length ?? 0, published };
  console.log("[cron/publish]", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
