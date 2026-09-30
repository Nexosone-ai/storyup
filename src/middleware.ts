import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  normalizeHost,
  isPrimaryHost,
  resolveCustomDomain,
} from "@/lib/customDomain";

export async function middleware(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));
  const path = request.nextUrl.pathname;

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
