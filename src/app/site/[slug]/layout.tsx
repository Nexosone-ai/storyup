import { siteStyleVars } from "@/components/website/siteStyle";
import { getPublishedSite } from "@/lib/queries";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { StoryupWatermark } from "@/components/site/StoryupWatermark";

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

  return (
    <div className="min-h-dvh" style={style}>
      {children}
      {showWatermark && <StoryupWatermark />}
    </div>
  );
}
