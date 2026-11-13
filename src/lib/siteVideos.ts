import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { SiteVideoItem } from "@/types/domain";

/** 공개 사이트에 보여줄 산출물 종류 — 카드뉴스 쇼츠(shorts)·AI 영상/편집본(video). */
export const SITE_VIDEO_KINDS = ["shorts", "video"] as const;

/**
 * 사업장의 공개 영상(쇼츠·AI 영상) — 공개 사이트(/site/<slug>/videos, 랜딩 '영상' 블록)용.
 * agency_deliverables 중 kind shorts|video 이고 is_public 이 false 가 아닌 것(0114 이전 DB 는
 * 컬럼이 없어 전부 공개로 취급). 공개 페이지라 service role 로 읽는다(RLS 변경 없음).
 */
export async function getSiteVideos(
  businessId: string,
  limit = 60,
): Promise<SiteVideoItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agency_deliverables")
    .select("*")
    .eq("business_id", businessId)
    .in("kind", [...SITE_VIDEO_KINDS])
    .order("created_at", { ascending: false })
    .limit(limit);
  const items: SiteVideoItem[] = [];
  for (const d of data ?? []) {
    const row = d as { is_public?: boolean | null } & typeof d;
    if (row.is_public === false) continue;
    if (!/^https?:\/\//i.test(d.url)) continue;
    items.push({
      id: d.id,
      kind: d.kind === "shorts" ? "shorts" : "video",
      title: d.title,
      url: d.url,
      createdAt: d.created_at,
    });
  }
  return items;
}
