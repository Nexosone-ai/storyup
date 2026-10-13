import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { recordImpression } from "@/lib/ads/charge";
import { ADS_ENABLED } from "@/lib/ads/config";

export const dynamic = "force-dynamic";

/** 광고 노출 기록(sendBeacon). CPC에선 과금 없음(CTR 집계용). */
export async function POST(request: Request) {
  if (!ADS_ENABLED) return NextResponse.json({ ok: true, skipped: true });
  let placementId = "";
  try {
    const body = await request.json();
    placementId = String(body.placementId ?? "");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!placementId) return NextResponse.json({ ok: false });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const vid = (await cookies()).get("bl_vid")?.value ?? null;
  const visitorKey = user ? `user:${user.id}` : vid ? `anon:${vid}` : null;

  await recordImpression(placementId, visitorKey, user?.id ?? null);
  return NextResponse.json({ ok: true });
}
