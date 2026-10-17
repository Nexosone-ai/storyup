import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * 유튜브 연결(쇼츠 자동 업로드) — 구글 OAuth(youtube.upload) 토큰 관리.
 * 영상 업로드 자체는 서버가 발급한 단기 access_token으로 브라우저가 유튜브에
 * 직접 올린다(패킷 최소·Vercel 본문 용량 제한 회피). refresh_token은 서버 전용.
 *
 * 필요한 환경변수:
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET  — Google Cloud OAuth 클라이언트
 *   GOOGLE_OAUTH_REDIRECT (선택)             — 미설정 시 {SITE_URL}/api/youtube/callback
 * Google Cloud에서 YouTube Data API v3 사용 설정 + 동의화면에 youtube.upload 범위 추가,
 * 승인된 리디렉션 URI에 위 콜백 주소 등록이 필요하다. (민감 범위 — 검수 전 업로드는 private 강제)
 */

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const YOUTUBE_REDIRECT =
  process.env.GOOGLE_OAUTH_REDIRECT || `${SITE_URL}/api/youtube/callback`;

const SCOPE =
  "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

/** OAuth 자격증명이 설정돼 있는지(미설정이면 기능 '준비중'으로 표시). */
export function youtubeConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

/** 구글 동의 화면 URL. state는 CSRF 방지용 난수. */
export function youtubeAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID ?? "",
    redirect_uri: YOUTUBE_REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // refresh_token을 항상 받도록 강제
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

interface TokenResp {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
  error?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResp> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json()) as TokenResp;
  if (!res.ok) throw new Error(json.error || "token request failed");
  return json;
}

/** 인가 코드 → 토큰(최초 연결 시 refresh_token 포함). */
export function exchangeCode(code: string): Promise<TokenResp> {
  return tokenRequest({
    code,
    client_id: CLIENT_ID ?? "",
    client_secret: CLIENT_SECRET ?? "",
    redirect_uri: YOUTUBE_REDIRECT,
    grant_type: "authorization_code",
  });
}

/** refresh_token → 단기 access_token. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const j = await tokenRequest({
    refresh_token: refreshToken,
    client_id: CLIENT_ID ?? "",
    client_secret: CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
  });
  return j.access_token;
}

/** 연결된 채널 정보. */
export async function getChannel(
  accessToken: string,
): Promise<{ id?: string; title?: string }> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return {};
    const j = await res.json();
    const ch = j.items?.[0];
    return { id: ch?.id, title: ch?.snippet?.title };
  } catch {
    return {};
  }
}

/** 연결 저장(upsert). refresh_token이 없으면(재동의 아님) 기존 토큰 유지. */
export async function saveConnection(input: {
  userId: string;
  refreshToken?: string;
  channelId?: string;
  channelTitle?: string;
  scope?: string;
}): Promise<void> {
  const admin = createAdminClient();
  const fields = {
    channel_id: input.channelId ?? null,
    channel_title: input.channelTitle ?? null,
    scope: input.scope ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.refreshToken) {
    // 최초 연결/재동의 — refresh_token 포함해 생성 또는 갱신.
    await admin.from("youtube_connections").upsert(
      { user_id: input.userId, refresh_token: input.refreshToken, ...fields },
      { onConflict: "user_id" },
    );
  } else {
    // refresh_token 없이 재연결 — 기존 토큰 유지, 채널 정보만 갱신.
    await admin
      .from("youtube_connections")
      .update(fields)
      .eq("user_id", input.userId);
  }
}

export async function getRefreshToken(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("youtube_connections")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.refresh_token ?? null;
}

export interface YoutubeStatus {
  configured: boolean;
  connected: boolean;
  channelTitle: string | null;
}

/** 마케팅/쇼츠 화면 표시용 연결 상태. */
export async function getYoutubeStatus(userId: string): Promise<YoutubeStatus> {
  const configured = youtubeConfigured();
  if (!configured) return { configured: false, connected: false, channelTitle: null };
  const admin = createAdminClient();
  const { data } = await admin
    .from("youtube_connections")
    .select("channel_title")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    configured: true,
    connected: !!data,
    channelTitle: data?.channel_title ?? null,
  };
}

export async function disconnect(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("youtube_connections").delete().eq("user_id", userId);
}
