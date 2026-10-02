import type { Metadata } from "next";
import { siteStyleVars } from "@/components/website/siteStyle";
import { getPublishedSite } from "@/lib/queries";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { StoryupWatermark } from "@/components/site/StoryupWatermark";
import { normalizeAdsensePublisherId } from "@/lib/adsense";

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
  const client = normalizeAdsensePublisherId(
    site?.website.content.adsense?.publisherId,
  );
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

  // Free 플랜 사이트는 하단에 STORYUP 워터마크를 표기한다(Basic+는 plan.watermarkRemoved로 제거).
  const showWatermark = site
    ? !getPlanById(await getPlanId(site.business.user_id)).watermarkRemoved
    : false;

  // 사장님이 연결한 Google AdSense 자동광고 — 입력은 신뢰하지 않고 항상 정규화해서
  // ca-pub-################ 형태만 스크립트 src에 넣는다.
  const adsenseClient = normalizeAdsensePublisherId(
    site?.website.content.adsense?.publisherId,
  );

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
