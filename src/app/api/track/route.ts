import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 공개 사이트 이벤트 수집 (조회·공유).
 * 슬러그로 공개된 사이트를 확인한 뒤 site_events에 기록한다 — 인증 불필요.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      slug?: string;
      event?: string;
      path?: string;
      channel?: string;
      referrer?: string;
    };

    const slug = String(body.slug ?? "").slice(0, 100);
    if (!slug) return NextResponse.json({ ok: false }, { status: 400 });
    const event = body.event === "share" ? "share" : "page_view";

    const supabase = await createClient();
    const { data: site } = await supabase
      .from("websites")
      .select("business_id")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (!site) return NextResponse.json({ ok: false }, { status: 404 });

    await supabase.from("site_events").insert({
      business_id: site.business_id,
      event,
      path: String(body.path ?? "").slice(0, 300),
      channel: body.channel ? String(body.channel).slice(0, 40) : null,
      referrer: body.referrer ? String(body.referrer).slice(0, 300) : null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
