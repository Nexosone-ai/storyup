import { getPublishedSite } from "@/lib/queries";
import { normalizeAdsensePublisherId, adsenseAdsTxtLine } from "@/lib/adsense";

/**
 * 사이트별 ads.txt.
 * 커스텀 도메인 요청은 미들웨어가 /ads.txt → /site/{slug}/ads.txt 로 rewrite하므로
 * (예: myshop.com/ads.txt), 이 핸들러가 그 사장님의 AdSense 퍼블리셔 라인을 낸다.
 * AdSense 승인·광고 서빙에 필요한 도메인 루트 ads.txt를 커스텀 도메인마다 자동 제공한다.
 * 연결 안 했거나 미게시면 404.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  const clientId = normalizeAdsensePublisherId(
    site?.website.content.adsense?.publisherId,
  );
  const line = clientId ? adsenseAdsTxtLine(clientId) : null;

  if (!line) {
    return new Response("", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(`${line}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
