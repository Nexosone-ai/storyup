/**
 * Google AdSense 자동광고 로더(Auto Ads) — 페이지 단위로 켠다(0113 광고 검수).
 * 종전에는 사이트 레이아웃에서 모든 페이지에 실렸지만, 회사(STORYUP) 광고는
 * 검수 통과(approved) 글과 승인 글이 있는 사이트의 홈·목록에만 싣는다.
 * client 는 호출부가 normalize 한 "ca-pub-################" 만 넘긴다(null 이면 아무것도 렌더하지 않음).
 */
export function AutoAdsLoader({ client }: { client: string | null }) {
  if (!client) return null;
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
    />
  );
}
