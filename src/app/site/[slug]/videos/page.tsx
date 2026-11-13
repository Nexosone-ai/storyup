import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedSite, getUser } from "@/lib/queries";
import { getSiteVideos } from "@/lib/siteVideos";
import {
  siteLang,
  SiteLogo,
  PoweredByStoryup,
} from "@/components/website/templates/shared";
import { SiteVideoGrid } from "@/components/site/SiteVideoGrid";
import { TrackPageView } from "@/components/site/TrackPageView";
import { buildSeo, siteBaseUrl } from "@/utils/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  const name = site?.website.content.hero?.businessName ?? "영상";
  const ko = site ? siteLang(site.website.content) === "ko" : true;
  return buildSeo({
    title: `${name} ${ko ? "영상" : "Videos"}`,
    path: `/site/${slug}/videos`,
    url: site ? `${siteBaseUrl(site.primaryDomain, slug)}/videos` : undefined,
  });
}

/**
 * 공개 사이트 '영상' 페이지 — 이 가게가 만든 쇼츠(카드뉴스 영상)와 AI 영상을 모두 보여준다.
 * 콘텐츠 스튜디오에서 저장한 영상 중 공개(is_public)인 것만. 사이트 주인에겐 관리 바로가기.
 */
export default async function PublicVideosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) notFound();

  const videos = await getSiteVideos(site.business.id);
  const name = site.website.content.hero?.businessName ?? site.business.name;
  const logo = site.website.content.hero?.logo;
  const ko = siteLang(site.website.content) === "ko";
  const viewer = await getUser();
  const manageHref =
    viewer && viewer.id === site.business.user_id
      ? `/business/${site.business.id}/marketing?step=6`
      : null;

  return (
    <div className="min-h-dvh bg-white">
      <TrackPageView slug={slug} />
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Link
            href={`/site/${slug}`}
            className="flex min-w-0 items-center gap-2 font-bold tracking-tight"
          >
            <SiteLogo
              src={logo}
              fallback={site.website.content.hero?.image}
              className="h-7 max-w-28"
              fallbackClassName="size-7"
            />
            <span className="truncate">{name}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            {manageHref && (
              <Link
                href={manageHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
              >
                {ko ? "영상 관리" : "Manage videos"}
              </Link>
            )}
            <Link href={`/site/${slug}`} className="text-sm text-muted">
              {ko ? "← 홈으로" : "← Home"}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          {ko ? "영상" : "Videos"}
        </h1>
        <p className="mb-8 text-sm text-muted">
          {ko
            ? "카드뉴스로 만든 쇼츠와 AI 영상이에요."
            : "Shorts made from card news and AI videos."}
        </p>
        {videos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted">
            {ko ? "아직 공개된 영상이 없어요." : "No videos yet."}
          </p>
        ) : (
          <SiteVideoGrid videos={videos} ko={ko} />
        )}
      </main>

      <footer className="border-t border-border py-8 text-center">
        <PoweredByStoryup lang={ko ? "ko" : "en"} />
      </footer>
    </div>
  );
}
