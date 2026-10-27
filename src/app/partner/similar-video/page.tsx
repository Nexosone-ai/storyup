import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isCurrentUserPartner,
  getPartnerCreditBalance,
  getCreditPrice,
} from "@/lib/partner";
import { videoEngineConfigured } from "@/lib/video";
import {
  parseYouTubeId,
  youtubeThumbnail,
  SIMILAR_VIDEO_ACTION,
} from "@/lib/similarVideo";
import {
  SimilarVideoStudio,
  type BatchView,
} from "@/components/partner/SimilarVideoStudio";

export const metadata = { title: "유사 영상 10개" };

/** 파트너 전용 — 원본 영상 URL + 컨셉으로 유사 영상 10개를 한 번에 생성. */
export default async function SimilarVideoPage() {
  if (!(await isCurrentUserPartner())) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const [credits, cost] = await Promise.all([
    getPartnerCreditBalance(user.id),
    getCreditPrice(SIMILAR_VIDEO_ACTION),
  ]);

  const { data: batches } = await supabase
    .from("similar_video_batches")
    .select("id, concept, source_url, aspect, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  const ids = (batches ?? []).map((b) => b.id);
  const { data: jobs } = ids.length
    ? await supabase
        .from("similar_video_jobs")
        .select("batch_id, idx, status, video_url, error")
        .in("batch_id", ids)
        .order("idx")
    : { data: [] };

  const jobMap = new Map<
    string,
    { idx: number; status: string; videoUrl?: string; error?: string }[]
  >();
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

  const views: BatchView[] = (batches ?? []).map((b) => {
    const ytId = parseYouTubeId(b.source_url);
    return {
      id: b.id,
      concept: b.concept,
      status: b.status,
      aspect: b.aspect,
      sourceThumb: ytId ? youtubeThumbnail(ytId) : null,
      jobs: jobMap.get(b.id) ?? [],
    };
  });

  return (
    <SimilarVideoStudio
      configured={videoEngineConfigured()}
      batches={views}
      credits={credits}
      cost={cost}
    />
  );
}
