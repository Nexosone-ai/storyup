import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * 카드뉴스 공개 공유 집계 — 감사 표시(thanks) / 조회(view) 1 증가.
 * 서버(서비스롤)에서 원자적 RPC로 수행. 로그인 불필요(공개 공유 페이지에서 호출).
 * 중복 방지는 클라이언트 localStorage(브라우저당 1회) — 비화폐 지표라 soft 수준.
 */
export async function POST(request: Request) {
  let id = "";
  let kind = "";
  try {
    const body = await request.json();
    id = String(body.id);
    kind = String(body.kind);
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (
    !/^[0-9a-fA-F-]{36}$/.test(id) ||
    (kind !== "thanks" && kind !== "view")
  )
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    kind === "thanks" ? "bump_card_thanks" : "bump_card_view",
    { p_id: id },
  );
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  return NextResponse.json({ ok: true, count: data ?? null });
}
