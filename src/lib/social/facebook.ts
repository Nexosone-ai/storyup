import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Facebook 페이지 연동 — Graph API로 페이지에 글/링크/이미지를 게시한다.
 * OAuth(동의) → 단기 유저토큰 → 장기 유저토큰 → 페이지 목록·페이지 액세스 토큰 저장.
 * 페이지 토큰은 서버 전용(social_connections, RLS 서비스롤)으로만 다룬다.
 *
 * 필요한 환경변수:
 *   FACEBOOK_APP_ID / FACEBOOK_APP_SECRET   — Meta 앱 자격증명
 *   FACEBOOK_OAUTH_REDIRECT (선택)          — 미설정 시 {SITE_URL}/api/social/facebook/callback
 * Meta 앱에 pages_manage_posts 권한 앱 리뷰 승인 + 리디렉션 URI 등록이 필요하다.
 * (승인 전에는 앱 관리자/테스터/테스트 페이지에서만 동작.)
 */

const APP_ID = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const FACEBOOK_REDIRECT =
  process.env.FACEBOOK_OAUTH_REDIRECT ||
  `${SITE_URL}/api/social/facebook/callback`;

const GRAPH = "https://graph.facebook.com/v21.0";
const SCOPE = "pages_show_list,pages_read_engagement,pages_manage_posts";

/** 자격증명이 설정돼 있는지(미설정이면 기능 '설정 필요'로 표시). */
export function facebookConfigured(): boolean {
  return !!(APP_ID && APP_SECRET);
}

/** 페이스북 동의 화면 URL. state는 CSRF 방지용 난수. */
export function facebookAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: APP_ID ?? "",
    redirect_uri: FACEBOOK_REDIRECT,
    state,
    scope: SCOPE,
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${p.toString()}`;
}

interface FbPage {
  id: string;
  name: string;
  access_token: string;
}

async function exchangeCodeForUserToken(code: string): Promise<string> {
  const p = new URLSearchParams({
    client_id: APP_ID ?? "",
    client_secret: APP_SECRET ?? "",
    redirect_uri: FACEBOOK_REDIRECT,
    code,
  });
  const res = await fetch(`${GRAPH}/oauth/access_token?${p.toString()}`);
  const j = await res.json();
  if (!res.ok || !j.access_token)
    throw new Error(j.error?.message || "facebook token exchange failed");
  return j.access_token as string;
}

async function longLivedUserToken(short: string): Promise<string> {
  const p = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: APP_ID ?? "",
    client_secret: APP_SECRET ?? "",
    fb_exchange_token: short,
  });
  const res = await fetch(`${GRAPH}/oauth/access_token?${p.toString()}`);
  const j = await res.json();
  return (j.access_token as string) || short;
}

async function listPages(userToken: string): Promise<FbPage[]> {
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(
      userToken,
    )}`,
  );
  const j = await res.json();
  return Array.isArray(j.data) ? (j.data as FbPage[]) : [];
}

/** 코드 교환 → 장기 유저토큰 → 페이지 저장(기존 교체). 저장된 페이지 수. */
export async function connectPages(
  businessId: string,
  userId: string,
  code: string,
): Promise<number> {
  const short = await exchangeCodeForUserToken(code);
  const longUser = await longLivedUserToken(short);
  const pages = await listPages(longUser);
  if (!pages.length) return 0;
  const admin = createAdminClient();
  await admin
    .from("social_connections")
    .delete()
    .eq("business_id", businessId)
    .eq("provider", "facebook_page");
  const rows = pages.map((pg) => ({
    user_id: userId,
    business_id: businessId,
    provider: "facebook_page" as const,
    external_id: pg.id,
    display_name: pg.name,
    access_token: pg.access_token,
    scope: SCOPE,
    enabled: true,
  }));
  await admin.from("social_connections").insert(rows);
  return pages.length;
}

export interface SocialStatus {
  configured: boolean;
  connected: boolean;
  pages: { id: string; name: string }[];
}

/** 연결 상태(표시용). 페이지 목록은 이름만. */
export async function getFacebookStatus(
  businessId: string,
): Promise<SocialStatus> {
  if (!facebookConfigured())
    return { configured: false, connected: false, pages: [] };
  const admin = createAdminClient();
  const { data } = await admin
    .from("social_connections")
    .select("external_id, display_name")
    .eq("business_id", businessId)
    .eq("provider", "facebook_page")
    .eq("enabled", true);
  const pages = (data ?? []).map((r) => ({
    id: r.external_id,
    name: r.display_name ?? r.external_id,
  }));
  return { configured: true, connected: pages.length > 0, pages };
}

export async function disconnectFacebook(businessId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("social_connections")
    .delete()
    .eq("business_id", businessId)
    .eq("provider", "facebook_page");
}

/** 연결된(활성) 페이지에 게시. pageId 미지정 시 첫 페이지. 성공 시 외부 게시글 ID. */
export async function postToFacebook(
  businessId: string,
  opts: { message: string; link?: string; imageUrl?: string; pageId?: string },
): Promise<{ postId: string; pageId: string }> {
  const admin = createAdminClient();
  let q = admin
    .from("social_connections")
    .select("external_id, access_token")
    .eq("business_id", businessId)
    .eq("provider", "facebook_page")
    .eq("enabled", true);
  if (opts.pageId) q = q.eq("external_id", opts.pageId);
  const { data } = await q.limit(1).maybeSingle();
  if (!data) throw new Error("연결된 Facebook 페이지가 없습니다.");
  const pageId = data.external_id;
  const token = data.access_token;
  if (!token) throw new Error("페이지 토큰이 없습니다.");

  if (opts.imageUrl) {
    const body = new URLSearchParams({
      url: opts.imageUrl,
      caption: opts.message,
      access_token: token,
    });
    const res = await fetch(`${GRAPH}/${pageId}/photos`, {
      method: "POST",
      body,
    });
    const j = await res.json();
    if (!res.ok)
      throw new Error(j.error?.message || "facebook 이미지 게시 실패");
    return { postId: j.post_id || j.id, pageId };
  }

  const params: Record<string, string> = {
    message: opts.message,
    access_token: token,
  };
  if (opts.link) params.link = opts.link;
  const res = await fetch(`${GRAPH}/${pageId}/feed`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || "facebook 게시 실패");
  return { postId: j.id as string, pageId };
}
