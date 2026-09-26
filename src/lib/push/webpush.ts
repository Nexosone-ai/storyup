import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * 웹 푸시 발송 — VAPID 키(env)로 서명해 저장된 구독 엔드포인트로 보낸다.
 * env 미설정이면 조용히 비활성(로그만). 만료(404/410)된 구독은 정리한다.
 *
 * 필요한 env:
 *  - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (서버 서명)
 *  - VAPID_SUBJECT (mailto: 또는 https URL, 기본 mailto:support@storyup.me)
 *  - NEXT_PUBLIC_VAPID_PUBLIC_KEY (클라이언트 구독용, 값은 VAPID_PUBLIC_KEY와 동일)
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@storyup.me",
    pub,
    priv,
  );
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** 사용자의 모든 기기로 푸시 발송. 발송 시도 수를 반환(구독 없거나 미설정이면 0). */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ensureConfigured()) return 0;
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // 만료·해지된 구독은 삭제 (다음부터 시도하지 않음)
        if (code === 404 || code === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("[webpush] send failed", code, s.endpoint);
        }
      }
    }),
  );
  return sent;
}
