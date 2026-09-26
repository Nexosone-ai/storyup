import { createAdminClient } from "@/lib/supabase/server";
import { getPlanById, type PlanId } from "@/lib/plans";
import { createSystemNotification } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push/webpush";
import { sendEmail } from "@/lib/email/resend";

/**
 * 구독 만기 알림 — 매일 크론이 호출.
 * 대상: 자동갱신되지 않는(billing_key 없는) 활성 구독 중 만기 7일 이내.
 *  - 마지막 7일간 매일: 인앱 알림 + 웹 푸시 (하루 1회 dedup)
 *  - 만기 3일 전(이하)부터: 이메일 1회 (기간당 1회 dedup)
 * 자동갱신 카드 구독(billing_key 있음)은 갱신되므로 제외한다.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.storyup.me";
const REPAY_PATH = "/dashboard/points";

/** Asia/Seoul 기준 YYYY-MM-DD */
function kstDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function daysUntil(end: Date, now: Date): number {
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}

/** reminder_log에 dedup 기록 시도. 새로 기록되면 true(=아직 안 보냄), 충돌이면 false. */
async function claim(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  channel: "daily" | "email",
  dedupKey: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("reminder_log")
    .insert({ user_id: userId, channel, dedup_key: dedupKey })
    .select("id")
    .maybeSingle();
  if (error) return false; // 유니크 충돌(이미 보냄) 또는 오류 → 발송 생략
  return !!data;
}

export interface ExpiryResult {
  scanned: number;
  pushed: number;
  emailed: number;
}

export async function runExpiryReminders(): Promise<ExpiryResult> {
  const admin = createAdminClient();
  const now = new Date();
  const todayKst = kstDay(now);
  const in7 = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const { data: subs, error } = await admin
    .from("subscriptions")
    .select("user_id, plan, current_period_end")
    .eq("status", "active")
    .is("billing_key", null)
    .not("current_period_end", "is", null)
    .gte("current_period_end", now.toISOString())
    .lte("current_period_end", in7)
    .limit(500);

  if (error) {
    console.error("[expiry] query failed", error.message);
    return { scanned: 0, pushed: 0, emailed: 0 };
  }

  let pushed = 0;
  let emailed = 0;

  for (const sub of subs ?? []) {
    const userId = sub.user_id as string;
    const end = new Date(sub.current_period_end as string);
    const endDay = kstDay(end);
    const left = daysUntil(end, now);
    const plan = getPlanById(sub.plan as PlanId);
    const endLabel = end.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // --- 매일: 인앱 + 웹 푸시 (하루 1회) ---
    const dailyKey = `expiry:${endDay}:${todayKst}`;
    if (await claim(admin, userId, "daily", dailyKey)) {
      const title =
        left <= 0
          ? "구독이 오늘 만료돼요"
          : `구독 만료 D-${left}`;
      const message = `${plan.name.ko} 플랜이 ${endLabel}에 만료됩니다. 계속 이용하려면 재결제해주세요.`;
      await createSystemNotification(admin, {
        userId,
        type: "sub_expiring",
        title,
        message,
        dedupKey: dailyKey,
      });
      const n = await sendPushToUser(userId, {
        title: `STORYUP · ${title}`,
        body: message,
        url: `${SITE_URL}${REPAY_PATH}`,
      });
      if (n > 0) pushed++;
    }

    // --- 만기 3일 전(이하)부터: 이메일 1회 ---
    if (left <= 3) {
      const emailKey = `expiry_email:${endDay}`;
      if (await claim(admin, userId, "email", emailKey)) {
        const { data: profile } = await admin
          .from("profiles")
          .select("name, email")
          .eq("user_id", userId)
          .maybeSingle();
        const to = profile?.email;
        if (to) {
          const ok = await sendEmail({
            to,
            subject: `[STORYUP] 구독이 ${left <= 0 ? "오늘" : `${left}일 뒤`} 만료됩니다`,
            html: expiryEmailHtml({
              name: profile?.name ?? null,
              planName: plan.name.ko,
              endLabel,
              left,
              url: `${SITE_URL}${REPAY_PATH}`,
            }),
          });
          if (ok) emailed++;
        }
      }
    }
  }

  return { scanned: subs?.length ?? 0, pushed, emailed };
}

function expiryEmailHtml(o: {
  name: string | null;
  planName: string;
  endLabel: string;
  left: number;
  url: string;
}): string {
  const hi = o.name ? `${o.name}님, ` : "";
  const when = o.left <= 0 ? "오늘" : `${o.left}일 뒤`;
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h1 style="font-size:20px;margin:0 0 16px">STORYUP 구독 만료 안내</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px">
      ${hi}이용 중인 <strong>${o.planName} 플랜</strong>이 <strong>${o.endLabel}</strong>(${when}) 만료됩니다.
    </p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
      끊김 없이 계속 이용하시려면 아래 버튼에서 재결제해주세요.
    </p>
    <a href="${o.url}" style="display:inline-block;background:#e8703a;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px">
      재결제하러 가기
    </a>
    <p style="font-size:12px;color:#888;line-height:1.6;margin:24px 0 0">
      본 메일은 만기 안내를 위해 발송되었습니다. STORYUP 대시보드에서 알림 설정을 관리할 수 있어요.
    </p>
  </div>`;
}
