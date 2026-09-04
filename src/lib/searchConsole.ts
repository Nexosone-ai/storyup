import { createSign } from "crypto";

/**
 * Google Search Console(Search Analytics) 연동 — 서비스 계정 JWT 방식 (외부 라이브러리 없음).
 *
 * 필요한 환경변수:
 * - GSC_CLIENT_EMAIL : 서비스 계정 이메일 (…@…iam.gserviceaccount.com)
 * - GSC_PRIVATE_KEY  : 서비스 계정 개인키 (JSON의 private_key 값, \n 이스케이프 허용)
 * - GSC_SITE_URL     : GSC 속성 식별자 (도메인 속성 "sc-domain:storyup.me"
 *                      또는 URL 접두어 속성 "https://www.storyup.me/")
 *
 * 서비스 계정 이메일을 Search Console 속성의 사용자로 추가해야 데이터가 조회된다.
 * 설정이 없으면 모든 함수가 null을 반환하고 상위 기능(업적·점수)은 조용히 건너뛴다.
 */

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function env() {
  const email = process.env.GSC_CLIENT_EMAIL;
  const key = process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const siteUrl = process.env.GSC_SITE_URL || "sc-domain:storyup.me";
  if (!email || !key) return null;
  return { email, key, siteUrl };
}

export function isSearchConsoleConfigured(): boolean {
  return env() !== null;
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

let tokenCache: { token: string; exp: number } | null = null;

/** 서비스 계정 JWT → OAuth 액세스 토큰 (55분 캐시). */
async function getAccessToken(): Promise<string | null> {
  const cfg = env();
  if (!cfg) return null;
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(
      JSON.stringify({
        iss: cfg.email,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    );
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const signature = signer.sign(cfg.key).toString("base64url");
    const assertion = `${header}.${claims}.${signature}`;

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) {
      console.error("[gsc] token exchange failed", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) return null;
    tokenCache = { token: json.access_token, exp: Date.now() + 55 * 60_000 };
    return json.access_token;
  } catch (err) {
    console.error("[gsc] token error", err);
    return null;
  }
}

export interface SearchTotals {
  impressions: number;
  clicks: number;
}

function dateStr(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/** 특정 경로 접두어(/site/슬러그)의 검색 노출·클릭 합계 (GSC 보존 기간: 최근 16개월). */
async function queryPathTotals(
  token: string,
  siteUrl: string,
  pathContains: string,
): Promise<SearchTotals | null> {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: dateStr(480),
        endDate: dateStr(0),
        dimensionFilterGroups: [
          {
            filters: [
              { dimension: "page", operator: "contains", expression: pathContains },
            ],
          },
        ],
        rowLimit: 1,
      }),
    },
  );
  if (!res.ok) {
    console.error("[gsc] query failed", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as {
    rows?: Array<{ impressions?: number; clicks?: number }>;
  };
  const row = json.rows?.[0];
  return {
    impressions: Math.round(row?.impressions ?? 0),
    clicks: Math.round(row?.clicks ?? 0),
  };
}

/**
 * 사용자 사이트 슬러그들의 검색 성과 합계.
 * 미설정/오류 시 null — 호출부는 조용히 건너뛴다.
 */
export async function fetchSearchTotalsForSlugs(
  slugs: string[],
): Promise<SearchTotals | null> {
  const cfg = env();
  if (!cfg || slugs.length === 0) return null;
  const token = await getAccessToken();
  if (!token) return null;

  const totals: SearchTotals = { impressions: 0, clicks: 0 };
  for (const slug of slugs.slice(0, 10)) {
    const t = await queryPathTotals(token, cfg.siteUrl, `/site/${slug}`);
    if (!t) return null;
    totals.impressions += t.impressions;
    totals.clicks += t.clicks;
  }
  return totals;
}
