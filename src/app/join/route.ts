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
  // as=partner: 파트너의 '영업파트너 모집 링크'. 가입자를 고객이 아니라 파트너(영업)으로 등록한다.
  const asPartner = req.nextUrl.searchParams.get("as") === "partner";
  const target = new URL("/signup", req.url);
  if (valid) target.searchParams.set("ref", ref);
  if (valid && asPartner) target.searchParams.set("as", "partner");
  const res = NextResponse.redirect(target);
  if (valid) {
    const opts = {
      httpOnly: true,
      sameSite: "lax" as const,
      maxAge: 7 * 86_400,
      path: "/",
    };
    res.cookies.set("su_ref", ref, opts);
    if (asPartner) res.cookies.set("su_ref_as", "partner", opts);
    else res.cookies.delete("su_ref_as");
  }
  return res;
}
