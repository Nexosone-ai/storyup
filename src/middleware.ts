import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  normalizeHost,
  isPrimaryHost,
  resolveCustomDomain,
  resolveSiteLocation,
} from "@/lib/customDomain";

/** /site/<slug>[/rest] → [slug, rest]. 매치 안 되면 null. */
function parseSitePath(path: string): { slug: string; rest: string } | null {
  const m = /^\/site\/([^/]+)(\/.*)?$/.exec(path);
  if (!m) return null;
  let slug = m[1];
  try {
    slug = decodeURIComponent(m[1]);
  } catch {
    /* 잘못된 인코딩은 원문 그대로 */
  }
  return { slug, rest: m[2] ?? "" };
}

export async function middleware(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));
  const path = request.nextUrl.pathname;

  // 주 도메인의 공개 사이트 URL — 사이트가 개인 도메인으로 옮겨졌거나 슬러그가 바뀌었으면
  // 검색엔진에 남은 옛 주소를 새 위치로 301 리다이렉트한다(404 대신). 개인 도메인 요청은
  // 아래에서 /site/… 로 '내부 rewrite' 되므로 여기(host=주 도메인)로 다시 오지 않아 루프 없음.
  if (isPrimaryHost(host)) {
    const site = parseSitePath(path);
    if (site) {
      const loc = await resolveSiteLocation(site.slug);
      if (loc) {
        const search = request.nextUrl.search;
        if (loc.domain) {
          return NextResponse.redirect(
            `https://${loc.domain}${site.rest}${search}`,
            301,
          );
        }
        if (loc.slug !== site.slug) {
          const url = request.nextUrl.clone();
          url.pathname = `/site/${loc.slug}${site.rest}`;
          return NextResponse.redirect(url, 301);
        }
      }
    }
  }

  // 커스텀(개인) 도메인 요청이면 해당 사업장의 공개 사이트로 rewrite.
  // 주 도메인/프리뷰/로컬, 그리고 앱 내부 경로(api·_next·이미 /site)는 검사 제외.
  const routable =
    !isPrimaryHost(host) &&
    !path.startsWith("/api") &&
    !path.startsWith("/_next") &&
    !path.startsWith("/site");
  if (routable) {
    const slug = await resolveCustomDomain(host);
    if (slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/site/${slug}${path === "/" ? "" : path}`;
      return NextResponse.rewrite(url);
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets and the public site image/OG
     * routes. This keeps the auth session fresh across the app.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
