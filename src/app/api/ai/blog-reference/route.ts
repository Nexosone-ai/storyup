import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { fetchLandingSource, UrlImportError } from "@/lib/urlImport";

export const maxDuration = 30;

/** 참조 자료 1건당 본문 텍스트 상한(프롬프트 과다 주입 방지). */
const PER_REF_MAX = 8000;

/**
 * 블로그 '참조 자료'용 — 입력한 웹주소에서 본문 텍스트만 추출해 돌려준다.
 * 글 생성 시 이 텍스트를 근거(글감 source)로 넘겨 자료 기반으로 작성하게 한다.
 * SSRF 방어(내부망 차단 등)는 lib/urlImport에서 처리한다. 이미지/AI 가공 없이
 * 원문 텍스트만 반환한다(저렴·안전).
 */
export async function POST(request: Request): Promise<Response> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: ko ? "로그인이 필요합니다." : "Please log in." },
      { status: 401 },
    );

  let businessId = "";
  let url = "";
  try {
    const body = (await request.json()) as {
      businessId?: string;
      url?: string;
    };
    businessId = String(body.businessId ?? "");
    url = String(body.url ?? "").trim();
  } catch {
    return NextResponse.json(
      { error: ko ? "잘못된 요청입니다." : "Invalid request." },
      { status: 400 },
    );
  }
  if (!url)
    return NextResponse.json(
      { error: ko ? "주소를 입력해주세요." : "Please enter a URL." },
      { status: 400 },
    );

  // 소유권 확인(RLS).
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz)
    return NextResponse.json(
      { error: ko ? "권한이 없습니다." : "You don't have permission." },
      { status: 403 },
    );

  try {
    const source = await fetchLandingSource(url);
    return NextResponse.json({
      name: source.name?.slice(0, 120) ?? "",
      text: source.text.slice(0, PER_REF_MAX),
    });
  } catch (err) {
    if (err instanceof UrlImportError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[ai/blog-reference]", err);
    return NextResponse.json(
      {
        error: ko
          ? "주소를 불러오는 중 문제가 발생했습니다. 다시 시도해주세요."
          : "Could not load that URL. Please try again.",
      },
      { status: 502 },
    );
  }
}
