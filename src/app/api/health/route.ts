import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diagnostic: reports which env vars are present (booleans only — never the
 * secret values) so misconfiguration is easy to spot. Safe to expose.
 */
export function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      IMAGE_PROVIDER: process.env.IMAGE_PROVIDER ?? null,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    },
  });
}
