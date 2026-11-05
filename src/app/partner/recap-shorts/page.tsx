import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { operableOwnerIds } from "@/lib/queries";
import {
  isCurrentUserPartner,
  getPartnerCreditBalance,
  getCreditPrice,
} from "@/lib/partner";
import { getYoutubeStatus } from "@/lib/youtube";
import {
  RECAP_SHORTS_ENABLED,
  RECAP_SHORTS_ACTION,
  RECAP_IMAGE_ACTION,
  recapProviderStatus,
} from "@/lib/recapShorts/config";
import { listRecapJobs, parseScenes } from "@/lib/recapShorts/jobs";
import {
  RecapShortsStudio,
  type RecapJobView,
} from "@/components/partner/RecapShortsStudio";

export const metadata = { title: "블로그 요약 쇼츠" };
// 서버 액션(Claude 대본·TTS 동시 합성)은 이 페이지 세그먼트의 람다에서 실행되므로 여기서 상한을 올린다.
export const maxDuration = 60;

export default async function RecapShortsPage() {
  if (!RECAP_SHORTS_ENABLED || !(await isCurrentUserPartner())) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const owners = await operableOwnerIds(supabase, user.id);
  const [{ data: bizs }, jobs, credits, basePrice, imagePrice, youtube] =
    await Promise.all([
      supabase.from("businesses").select("id, name").in("user_id", owners).limit(100),
      listRecapJobs(user.id, 20),
      getPartnerCreditBalance(user.id),
      getCreditPrice(RECAP_SHORTS_ACTION),
      getCreditPrice(RECAP_IMAGE_ACTION),
      getYoutubeStatus(user.id),
    ]);

  const bizMap = new Map((bizs ?? []).map((b) => [b.id, b.name]));
  const jobViews: RecapJobView[] = jobs.map((j) => ({
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

  return (
    <RecapShortsStudio
      businesses={(bizs ?? []).map((b) => ({ id: b.id, name: b.name }))}
      jobs={jobViews}
      credits={credits}
      basePrice={basePrice}
      imagePrice={imagePrice}
      providers={recapProviderStatus()}
      youtube={{
        configured: youtube.configured,
        connected: youtube.connected,
        channelTitle: youtube.channelTitle,
      }}
    />
  );
}
