import type { Metadata } from "next";
import { siteStyleVars } from "@/components/website/siteStyle";
import { getPublishedSite } from "@/lib/queries";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { StoryupWatermark } from "@/components/site/StoryupWatermark";
import {
  normalizeAdsensePublisherId,
  companyAdsenseClient,
} from "@/lib/adsense";

/**
 * AdSense 사이트 인증 메타(google-adsense-account)를 <head>에 넣는다.
 * Metadata API를 쓰면 fork의 React 호이스팅 동작과 무관하게 항상 head에 보장된다.
 * (자동광고 로더 <script>는 아래 레이아웃 본문에서 렌더 — body 실행으로도 자동광고는 동작.)
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) return {};
  // 무료 사이트는 회사(STORYUP) 자동광고, 유료는 사장님 본인 AdSense의 인증 메타.
  const isFreeOwner =
    getPlanById(await getPlanId(site.business.user_id)).id === "free";
  const client = isFreeOwner
    ? companyAdsenseClient()
    : normalizeAdsensePublisherId(site.website.content.adsense?.publisherId);
  return client
    ? { other: { "google-adsense-account": client } }
    : {};
}

/** Applies the site owner's chosen palette/font to the homepage and blog. */
export default async function PublishedSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  const style = site ? siteStyleVars(site.website.content.style) : undefined;

  // 사이트 소유자 요금제 — 워터마크 제거 여부 + 무료 티어 회사 광고 판정에 공용.
  const ownerPlan = site
    ? getPlanById(await getPlanId(site.business.user_id))
    : null;
  // Free 플랜 사이트는 하단에 STORYUP 워터마크를 표기한다(Basic+는 plan.watermarkRemoved로 제거).
  const showWatermark = ownerPlan ? !ownerPlan.watermarkRemoved : false;

  // 광고 자동 로더(Auto Ads):
  //  - 무료 사이트 → 회사(STORYUP) AdSense로 무료 티어를 수익화.
  //  - 유료 사이트 → 사장님이 연결한 본인 AdSense만(미연결이면 광고 없음).
  // 입력은 신뢰하지 않고 항상 정규화해 ca-pub-################ 형태만 script src에 넣는다.
  const adsenseClient =
    ownerPlan?.id === "free"
      ? companyAdsenseClient()
      : normalizeAdsensePublisherId(site?.website.content.adsense?.publisherId);

  return (
    <div className="min-h-dvh" style={style}>
      {adsenseClient && (
        // 자동광고 로더 — Google이 광고 위치를 자동 배치한다(Auto Ads). 인증 메타는 generateMetadata로 head에.
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
          crossOrigin="anonymous"
        />
      )}
      {children}
      {showWatermark && <StoryupWatermark />}
    </div>
  );
}
