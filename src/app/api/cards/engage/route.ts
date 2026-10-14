import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * 카드뉴스 공개 공유 집계 — 공유(share) / 조회(view) 1 증가. (감사 지표는 폐지)
 * 서버(서비스롤)에서 원자적 RPC로 수행. 로그인 불필요(공개 공유 페이지에서 호출).
 * 중복 방지는 클라이언트 localStorage(브라우저당 1회) — soft 수준의 비화폐 지표.
 */
export async function POST(request: Request) {
  let body: {
    id?: unknown;
    kind?: unknown;
    channel?: unknown;
    visitor?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const id = String(body.id ?? "");
  const kind = String(body.kind ?? "");
  if (
    !/^[0-9a-fA-F-]{36}$/.test(id) ||
    (kind !== "share" && kind !== "view")
  )
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  const admin = createAdminClient();

  if (kind === "share") {
    const channel =
      typeof body.channel === "string" ? body.channel.slice(0, 24) : "link";
    const visitor =
      typeof body.visitor === "string" ? body.visitor.slice(0, 64) : null;
    const { data, error } = await admin.rpc("bump_card_share", {
      p_id: id,
      p_channel: channel,
      p_visitor: visitor,
    });
    if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
    return NextResponse.json({ ok: true, count: data ?? null });
  }

  const { data, error } = await admin.rpc("bump_card_view", { p_id: id });
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  return NextResponse.json({ ok: true, count: data ?? null });
}
