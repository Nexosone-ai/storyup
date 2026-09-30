/**
 * 커스텀(개인) 도메인 해석 — 미들웨어(Edge)에서 호스트를 사업장 사이트 slug로 바꾼다.
 * Edge 런타임에서 동작해야 하므로 fetch(Supabase REST RPC)만 사용한다.
 */

/** 앱 자체 도메인(주 도메인). 이 도메인·서브도메인은 커스텀 도메인 취급하지 않는다. */
const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || "storyup.me").toLowerCase();

/** host 헤더에서 포트 제거 + 소문자화. */
export function normalizeHost(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.split(":")[0].trim().toLowerCase();
}

/** 주 도메인/프리뷰/로컬 등 커스텀 도메인이 아닌 호스트인지. */
export function isPrimaryHost(host: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]")
    return true;
  if (host.endsWith(".localhost")) return true;
  if (host.endsWith(".vercel.app")) return true;
  if (host === APP_DOMAIN || host.endsWith(`.${APP_DOMAIN}`)) return true;
  return false;
}

// Edge 인스턴스별 짧은 캐시 — 요청마다 RPC를 치지 않도록.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { slug: string | null; exp: number }>();

/**
 * 활성(active) 커스텀 도메인 → 공개된 사이트 slug. 없으면 null.
 * resolve_custom_domain(0040) SECURITY DEFINER RPC를 anon 키로 호출.
 */
export async function resolveCustomDomain(host: string): Promise<string | null> {
  const now = Date.now();
  const hit = cache.get(host);
  if (hit && hit.exp > now) return hit.slug;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  let slug: string | null = null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/resolve_custom_domain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_domain: host }),
      // 미들웨어 지연 최소화 — 실패 시 그냥 주 앱으로 폴백.
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as string | null;
      slug = typeof data === "string" && data.length > 0 ? data : null;
    }
  } catch {
    slug = null;
  }

  cache.set(host, { slug, exp: now + CACHE_TTL_MS });
  return slug;
}
