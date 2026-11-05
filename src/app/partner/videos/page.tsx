import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { operableOwnerIds } from "@/lib/queries";
import {
  isCurrentUserPartner,
  getPartnerCreditBalance,
  getCreditPrice,
} from "@/lib/partner";
import { getYoutubeStatus } from "@/lib/youtube";
import { videoEngineConfigured } from "@/lib/video";
import {
  parseYouTubeId,
  youtubeThumbnail,
  SIMILAR_VIDEO_ACTION,
} from "@/lib/similarVideo";
import {
  RECAP_SHORTS_ENABLED,
  RECAP_SHORTS_ACTION,
  RECAP_IMAGE_ACTION,
  recapProviderStatus,
} from "@/lib/recapShorts/config";
import { listRecapJobs, parseScenes } from "@/lib/recapShorts/jobs";
import { PROVIDEO_ENABLED, providerStatus } from "@/lib/provideo/config";
import {
  PartnerVideoHub,
  type VideoHubTab,
} from "@/components/partner/PartnerVideoHub";
import type { RecapJobView } from "@/components/partner/RecapShortsStudio";
import type { BatchView } from "@/components/partner/SimilarVideoStudio";
import type { ProjectRow } from "@/components/provideo/ProVideoStudio";

export const metadata = { title: "영상 만들기" };
// 요약 쇼츠의 서버 액션(Claude 대본·TTS 동시 합성)은 이 페이지 세그먼트의 람다에서 실행되므로
// 상한을 여기서 올린다(기본 10~15초면 타임아웃).
export const maxDuration = 60;

const TABS: VideoHubTab[] = ["recap", "similar", "pro"];

/**
 * 파트너 영상 허브 — '글로 영상 만들기(요약 쇼츠)'와 'AI로 관련 영상 10개(유사영상)',
 * (플래그) 전문 영상 스튜디오를 한 페이지의 탭으로 묶는다. 구 라우트는 여기로 리다이렉트.
 */
export default async function PartnerVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await isCurrentUserPartner())) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { tab: tabParam } = await searchParams;
  const recapOn = RECAP_SHORTS_ENABLED;
  const proOn = PROVIDEO_ENABLED;
  const wanted = TABS.includes(tabParam as VideoHubTab) ? (tabParam as VideoHubTab) : null;
  const initialTab: VideoHubTab =
    wanted === "recap" && !recapOn
      ? "similar"
      : wanted === "pro" && !proOn
        ? "similar"
        : (wanted ?? (recapOn ? "recap" : "similar"));

  // 1차: 독립 조회를 한 번에.
  const [
    owners,
    credits,
    similarCost,
    recapBase,
    recapImage,
    youtube,
    recapJobs,
    { data: batches },
    { data: projects },
  ] = await Promise.all([
    operableOwnerIds(supabase, user.id),
    getPartnerCreditBalance(user.id),
    getCreditPrice(SIMILAR_VIDEO_ACTION),
    recapOn ? getCreditPrice(RECAP_SHORTS_ACTION) : Promise.resolve(null),
    recapOn ? getCreditPrice(RECAP_IMAGE_ACTION) : Promise.resolve(null),
    getYoutubeStatus(user.id),
    recapOn ? listRecapJobs(user.id, 20) : Promise.resolve([]),
    supabase
      .from("similar_video_batches")
      .select("id, concept, source_url, aspect, seconds, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    proOn
      ? supabase
          .from("provideo_projects")
          .select("id, title, concept, status, aspect, quality, created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as ProjectRow[] }),
  ]);

  // 2차: 1차 결과에 의존하는 조회.
  const batchIds = (batches ?? []).map((b) => b.id);
  const [{ data: bizs }, { data: jobs }] = await Promise.all([
    supabase.from("businesses").select("id, name").in("user_id", owners).limit(100),
    batchIds.length
      ? supabase
          .from("similar_video_jobs")
          .select("batch_id, idx, status, video_url, error")
          .in("batch_id", batchIds)
          .order("idx")
      : Promise.resolve({ data: [] as { batch_id: string; idx: number; status: string; video_url: string | null; error: string | null }[] }),
  ]);
  const businesses = (bizs ?? []).map((b) => ({ id: b.id, name: b.name }));

  // 유사영상 배치 뷰.
  const jobMap = new Map<string, BatchView["jobs"]>();
  for (const j of jobs ?? []) {
    const arr = jobMap.get(j.batch_id) ?? [];
    arr.push({
      idx: j.idx,
      status: j.status,
      videoUrl: j.video_url ?? undefined,
      error: j.error ?? undefined,
    });
    jobMap.set(j.batch_id, arr);
  }
  const similarBatches: BatchView[] = (batches ?? []).map((b) => {
    const ytId = parseYouTubeId(b.source_url);
    return {
      id: b.id,
      concept: b.concept,
      status: b.status,
      aspect: b.aspect,
      seconds: b.seconds,
      sourceThumb: ytId ? youtubeThumbnail(ytId) : null,
      jobs: jobMap.get(b.id) ?? [],
    };
  });

  // 요약 쇼츠 잡 뷰.
  const bizMap = new Map(businesses.map((b) => [b.id, b.name]));
  const recapViews: RecapJobView[] = recapJobs.map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    voice: j.voice,
    imageSource: j.image_source,
    font: j.font,
    bgm: j.bgm,
    scenes: parseScenes(j.scenes),
    creditsCharged: j.credits_charged,
    videoUrl: j.video_url,
    businessName: j.business_id ? (bizMap.get(j.business_id) ?? null) : null,
    createdAt: j.created_at,
  }));

  const proRows: ProjectRow[] = (projects ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    concept: p.concept,
    status: p.status,
    aspect: p.aspect,
    quality: p.quality,
  }));

  return (
    <PartnerVideoHub
      initialTab={initialTab}
      credits={credits}
      recap={
        recapOn
          ? {
              businesses,
              jobs: recapViews,
              basePrice: recapBase,
              imagePrice: recapImage,
              providers: recapProviderStatus(),
              youtube: {
                configured: youtube.configured,
                connected: youtube.connected,
                channelTitle: youtube.channelTitle,
              },
            }
          : null
      }
      similar={{
        configured: videoEngineConfigured(),
        batches: similarBatches,
        cost: similarCost,
      }}
      pro={proOn ? { projects: proRows, businesses, providers: providerStatus() } : null}
    />
  );
}
