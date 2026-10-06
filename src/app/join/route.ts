import { NextResponse, type NextRequest } from "next/server";

/**
 * 추천 링크 랜딩 — storyup.me/join?ref=ABC123
 * 코드를 쿠키에 담고, 가입 페이지 URL(?ref=)에도 실어 보낸다.
 * - 쿠키: 같은 브라우저에서 가입하면 대시보드 첫 로드 때 귀속
 * - URL: 가입 폼(이메일·소셜)이 hidden 값으로 서버에 넘겨 쿠키가 없어도 귀속
 * (가입 3일 이내만 인정)
 */
export function GET(req: NextRequest) {
  const ref = (req.nextUrl.searchParams.get("ref") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 12);
  const valid = /^[A-Z0-9]{4,12}$/.test(ref);
  const target = new URL("/signup", req.url);
  if (valid) target.searchParams.set("ref", ref);
  const res = NextResponse.redirect(target);
  if (valid) {
    res.cookies.set("su_ref", ref, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 86_400,
      path: "/",
    });
  }
  return res;
}
