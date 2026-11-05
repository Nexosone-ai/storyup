import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import type { RecapScene, RecapStatus } from "./config";

export type RecapJobRow =
  Database["public"]["Tables"]["recap_shorts_jobs"]["Row"];

/** scenes jsonb → 타입 안전한 배열(손상된 원소는 버린다). */
export function parseScenes(json: Json | null | undefined): RecapScene[] {
  if (!Array.isArray(json)) return [];
  const out: RecapScene[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    const idx = Number(r.idx);
    if (!Number.isFinite(idx)) continue;
    out.push({
      idx,
      narration: String(r.narration ?? ""),
      caption: String(r.caption ?? ""),
      imagePrompt: String(r.imagePrompt ?? ""),
      imageUrl: typeof r.imageUrl === "string" ? r.imageUrl : null,
      audioUrl: typeof r.audioUrl === "string" ? r.audioUrl : null,
      durationMs: typeof r.durationMs === "number" ? r.durationMs : null,
      error: typeof r.error === "string" ? r.error : null,
    });
  }
  return out.sort((a, b) => a.idx - b.idx);
}

/** 본인(파트너) 소유 잡 1건. 아니면 null. */
export async function getRecapJob(
  userId: string,
  jobId: string,
): Promise<RecapJobRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("recap_shorts_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function listRecapJobs(
  userId: string,
  limit = 20,
): Promise<RecapJobRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("recap_shorts_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** scenes 전체 교체(+상태). 소유 확인은 호출부가 했다고 가정(user_id 조건으로 한 번 더 방어). */
export async function saveRecapScenes(
  userId: string,
  jobId: string,
  scenes: RecapScene[],
  status?: RecapStatus,
): Promise<boolean> {
  const admin = createAdminClient();
  const patch: Database["public"]["Tables"]["recap_shorts_jobs"]["Update"] = {
    scenes: scenes as unknown as Json,
    updated_at: new Date().toISOString(),
  };
  if (status) patch.status = status;
  const { error } = await admin
    .from("recap_shorts_jobs")
    .update(patch)
    .eq("id", jobId)
    .eq("user_id", userId);
  if (error) console.error("[recap] save scenes failed", error);
  return !error;
}

export async function setRecapStatus(
  userId: string,
  jobId: string,
  status: RecapStatus,
  extra?: { error?: string | null; video_url?: string | null },
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("recap_shorts_jobs")
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("user_id", userId);
}

/**
 * 블로그 글의 카드뉴스 '배경 이미지' 목록(cover→slides→cta 순, 최신 카드뉴스 1세트).
 * 합성된 카드가 아니라 배경 사진이라 자막을 따로 입히는 쇼츠에 적합하다. 없으면 null.
 */
export async function cardBackgroundsForPost(
  businessId: string,
  blogPostId: string,
): Promise<string[] | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("marketing_contents")
    .select("content")
    .eq("business_id", businessId)
    .eq("blog_post_id", blogPostId)
    .eq("platform", "instagram_cards")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.content) return null;
  try {
    const parsed = JSON.parse(data.content) as { images?: unknown };
    const imgs = Array.isArray(parsed.images)
      ? parsed.images.filter((u): u is string => typeof u === "string" && u.length > 0)
      : [];
    return imgs.length > 0 ? imgs : null;
  } catch {
    return null;
  }
}

export interface RecapCandidatePost {
  id: string;
  title: string;
  publishedAt: string | null;
  /** 카드뉴스 배경 이미지가 있어 '카드뉴스' 소스를 쓸 수 있는지. */
  hasCardBackgrounds: boolean;
}

/**
 * 사업장의 발행 글 목록 + 카드뉴스 배경 보유 여부(소스 선택 UI용).
 * 글은 세션 RLS(파트너 고객 포함), 카드뉴스는 관리자 클라이언트로 한 번에 조회.
 */
export async function listRecapCandidatePosts(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  businessId: string,
): Promise<RecapCandidatePost[]> {
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, published_at")
    .eq("business_id", businessId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(100);
  const rows = posts ?? [];
  if (rows.length === 0) return [];

  const admin = createAdminClient();
  const { data: cards } = await admin
    .from("marketing_contents")
    .select("blog_post_id, content")
    .eq("business_id", businessId)
    .eq("platform", "instagram_cards")
    .in("blog_post_id", rows.map((p) => p.id));
  const withBg = new Set<string>();
  for (const c of cards ?? []) {
    if (!c.blog_post_id) continue;
    try {
      const parsed = JSON.parse(c.content) as { images?: unknown };
      if (Array.isArray(parsed.images) && parsed.images.some((u) => typeof u === "string" && u))
        withBg.add(c.blog_post_id);
    } catch {
      /* skip */
    }
  }
  return rows.map((p) => ({
    id: p.id,
    title: p.title ?? "",
    publishedAt: p.published_at ?? null,
    hasCardBackgrounds: withBg.has(p.id),
  }));
}

/** 장면 상태로 잡의 다음 status를 정한다(모든 오디오·이미지가 준비되면 ready). */
export function deriveStatus(
  scenes: RecapScene[],
  imageSource: "cardnews" | "ai",
): RecapStatus {
  const audioDone = scenes.every((s) => !!s.audioUrl);
  if (!audioDone) return "audio";
  const imagesDone =
    imageSource === "cardnews" || scenes.every((s) => !!s.imageUrl);
  return imagesDone ? "ready" : "images";
}
