import { companyAdsenseClient, adsenseAdsTxtLine } from "@/lib/adsense";

/**
 * 주 도메인(storyup.me) 루트 ads.txt.
 * 무료 사용자 발행 페이지(storyup.me/site/{slug})에 노출되는 회사(STORYUP)
 * AdSense 자동광고를 위해 회사 퍼블리셔 라인을 낸다. AdSense가 이 도메인의
 * 광고 인벤토리를 인증·서빙하는 데 필요하다.
 *
 * 커스텀(개인) 도메인 요청의 /ads.txt는 미들웨어가 /site/{slug}/ads.txt로
 * rewrite하므로 여기로 오지 않는다(사장님 본인 퍼블리셔 라인은 그쪽에서 처리).
 */
export async function GET(): Promise<Response> {
  const client = companyAdsenseClient();
  const line = client ? adsenseAdsTxtLine(client) : null;

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
