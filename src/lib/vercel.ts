import "server-only";

/**
 * Vercel Domains API 연동 — 개인(커스텀) 도메인을 배포 프로젝트에 자동 등록/검증/해제한다.
 *
 * env 가 모두 설정돼 있을 때만 동작한다(미설정이면 no-op → 기존 수동 활성화 흐름 유지).
 * 필요한 env:
 *  - VERCEL_TOKEN      : 계정/팀 API 토큰(Domains 권한)
 *  - VERCEL_PROJECT_ID : 배포 프로젝트 id (prj_...). .vercel/project.json 의 projectId.
 *  - VERCEL_TEAM_ID    : 팀(orgId, team_...). 개인 계정이면 생략 가능.
 *
 * 설계 메모: "연결 가능(서빙 가능)" = 프로젝트에 attach + verified + !misconfigured.
 *  - verified      : 도메인이 다른 Vercel 계정/프로젝트에 선점되지 않아 이 프로젝트가 소유 확인됨.
 *  - misconfigured : DNS(A/CNAME)가 아직 Vercel을 가리키지 않음(전파 전).
 */

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

/** env 가 갖춰져 자동 등록/검증을 쓸 수 있는지. */
export function vercelDomainsConfigured(): boolean {
  return !!(TOKEN && PROJECT_ID);
}

function teamQuery(extra?: string): string {
  const parts: string[] = [];
  if (TEAM_ID) parts.push(`teamId=${encodeURIComponent(TEAM_ID)}`);
  if (extra) parts.push(extra);
  return parts.length ? `?${parts.join("&")}` : "";
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };
}

export interface VercelDomainStatus {
  /** 프로젝트에 도메인이 등록돼 있는지. */
  attached: boolean;
  /** 소유 확인(다른 계정 선점 아님). */
  verified: boolean;
  /** DNS 가 아직 Vercel 을 안 가리킴(전파 전/오설정). */
  misconfigured: boolean;
}

export interface AddDomainResult {
  ok: boolean;
  verified: boolean;
  /** "not_configured" | "in_use" | 기타 메시지 */
  error?: string;
}

/**
 * 도메인을 배포 프로젝트에 추가한다. 이미 이 프로젝트에 있으면 성공으로 간주한다.
 * 다른 프로젝트/계정이 선점 중이면 { ok:false, error:"in_use" }.
 */
export async function addDomainToProject(
  domain: string,
): Promise<AddDomainResult> {
  if (!vercelDomainsConfigured())
    return { ok: false, verified: false, error: "not_configured" };
  try {
    const res = await fetch(
      `https://api.vercel.com/v10/projects/${PROJECT_ID}/domains${teamQuery()}`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: domain }),
      },
    );
    const json = (await res.json()) as {
      verified?: boolean;
      error?: { code?: string; message?: string };
    };
    if (res.ok) return { ok: true, verified: !!json.verified };

    const code = json.error?.code;
    // 이미 이 프로젝트에 붙어 있으면 성공으로 취급(멱등).
    if (code === "domain_already_in_project")
      return { ok: true, verified: true };
    if (code === "domain_already_in_use" || code === "forbidden")
      return { ok: false, verified: false, error: "in_use" };
    return {
      ok: false,
      verified: false,
      error: json.error?.message ?? "vercel_error",
    };
  } catch (err) {
    console.error("[vercel] addDomainToProject failed", err);
    return { ok: false, verified: false, error: "network" };
  }
}

/** 프로젝트 도메인 + DNS 설정 상태를 조회한다(미설정 env면 null). */
export async function getDomainStatus(
  domain: string,
): Promise<VercelDomainStatus | null> {
  if (!vercelDomainsConfigured()) return null;
  try {
    // 1) 프로젝트에 붙어 있는지 + verified
    const dRes = await fetch(
      `https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/${domain}${teamQuery()}`,
      { headers: authHeaders() },
    );
    if (dRes.status === 404)
      return { attached: false, verified: false, misconfigured: true };
    const d = (await dRes.json()) as { verified?: boolean };

    // 2) DNS 설정(전파) 상태
    const cRes = await fetch(
      `https://api.vercel.com/v6/domains/${domain}/config${teamQuery()}`,
      { headers: authHeaders() },
    );
    const c = (await cRes.json()) as { misconfigured?: boolean };

    return {
      attached: true,
      verified: !!d.verified,
      misconfigured: !!c.misconfigured,
    };
  } catch (err) {
    console.error("[vercel] getDomainStatus failed", err);
    return null;
  }
}

/** 도메인을 프로젝트에서 제거한다(연결 해제). env 미설정이면 조용히 패스. */
export async function removeDomainFromProject(domain: string): Promise<void> {
  if (!vercelDomainsConfigured()) return;
  try {
    await fetch(
      `https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/${domain}${teamQuery()}`,
      { method: "DELETE", headers: authHeaders() },
    );
  } catch (err) {
    // 제거 실패는 치명적이지 않다(수동 정리 가능) — 로그만 남긴다.
    console.error("[vercel] removeDomainFromProject failed", err);
  }
}
