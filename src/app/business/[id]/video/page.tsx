import { notFound } from "next/navigation";
import { getUser, getBusiness } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { getVideoPricing, videoEngineConfigured } from "@/lib/video";
import { listDeliverables } from "@/lib/agency";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { VideoStudio } from "@/components/video/VideoStudio";

export const metadata = { title: "AI 영상" };

export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ko = (await getLocale()) === "ko";
  const business = await getBusiness(id);
  if (!business) notFound();
  const user = await getUser();
  const plan = getPlanById(user ? await getPlanId(user.id) : "free");

  if (plan.limits.video === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "AI 영상" : "AI video"}
        </h1>
        <Card className="flex flex-col items-start gap-3 p-8">
          <p className="text-lg font-semibold">
            {ko
              ? "AI 영상은 유료 플랜(Basic/Pro)에서 사용할 수 있어요."
              : "AI video is available on Basic/Pro."}
          </p>
          <p className="text-sm text-muted">
            {ko
              ? "AI 영상은 생성 1편당 UP 포인트가 차감됩니다. 유료 플랜에서 사용할 수 있어요."
              : "AI video costs UP points per generation, available on paid plans."}
          </p>
          <ButtonLink href="/dashboard/plans">
            {ko ? "플랜 업그레이드" : "Upgrade"}
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const [pricing, deliverables] = await Promise.all([
    getVideoPricing(user!.id),
    listDeliverables(id),
  ]);
  const videos = deliverables.filter((d) => d.kind === "video");

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">{ko ? "AI 영상" : "AI video"}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "AI 영상 만들기" : "Make an AI video"}
        </h1>
        <p className="mt-1.5 text-muted">
          {ko
            ? "원하는 장면을 설명하면 AI가 영상을 만들어줘요. 완성된 영상은 랜딩·홈페이지·블로그·SNS 카드에 바로 쓸 수 있어요."
            : "Describe a scene and AI makes a video you can use anywhere."}
        </p>
      </div>
      <VideoStudio
        businessId={id}
        pricing={{ price: pricing.price, balance: pricing.balance }}
        engineReady={videoEngineConfigured()}
        videos={videos}
        ko={ko}
      />
    </div>
  );
}
