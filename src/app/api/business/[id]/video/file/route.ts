import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 우리 Supabase 스토리지 호스트(편집본 저장 위치) — 임의 주소 요청(SSRF) 방지용 허용 목록.
let SUPABASE_HOST = "";
try {
  SUPABASE_HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.toLowerCase();
} catch {
  /* 미설정 시 fal 도메인만 허용 */
}

/** fal 미디어/큐 + 우리 Supabase 스토리지만 허용 — SSRF 방지. */
function isAllowedVideoUrl(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return (
      h === "fal.media" ||
      h.endsWith(".fal.media") ||
      h === "fal.run" ||
      h.endsWith(".fal.run") ||
      (!!SUPABASE_HOST && h === SUPABASE_HOST)
    );
  } catch {
    return false;
  }
}

/**
 * 완성 영상 프록시 — 브라우저 편집기가 same-origin으로 영상을 받아
 * canvas 재인코딩(자르기·자막·음악·비율) 시 CORS 오염 없이 쓰게 한다.
 * 소유권은 세션 RLS(owns_business)로 agency_deliverables 조회해 보장한다.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await ctx.params;
  const deliverableId = new URL(request.url).searchParams.get("d");
  if (!deliverableId) return new Response("missing d", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  // RLS: 본인 사업장(소유자·직원·배정 파트너)만 조회됨.
  const { data: row } = await supabase
    .from("agency_deliverables")
    .select("url, kind")
    .eq("id", deliverableId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!row || row.kind !== "video" || !row.url)
    return new Response("not found", { status: 404 });
  if (!isAllowedVideoUrl(row.url)) return new Response("forbidden", { status: 403 });

  const upstream = await fetch(row.url);
  if (!upstream.ok || !upstream.body)
    return new Response("upstream error", { status: 502 });

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") || "video/mp4",
  );
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  // 편집 중에만 쓰는 사적 자료 — 캐시는 사용자 로컬만.
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(upstream.body, { status: 200, headers });
}
