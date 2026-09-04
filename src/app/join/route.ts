import { NextResponse, type NextRequest } from "next/server";

/**
 * 추천 링크 랜딩 — storyup.me/join?ref=ABC123
 * 코드를 쿠키에 담아 가입 페이지로 보낸다. 가입 후 첫 대시보드 로드에서
 * 서버가 쿠키를 읽어 추천을 귀속한다 (가입 3일 이내만 인정).
 */
export function GET(req: NextRequest) {
  const ref = (req.nextUrl.searchParams.get("ref") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 12);
  const res = NextResponse.redirect(new URL("/signup", req.url));
  if (/^[A-Z0-9]{4,12}$/.test(ref)) {
    res.cookies.set("su_ref", ref, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 86_400,
      path: "/",
    });
  }
  return res;
}
