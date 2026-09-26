/**
 * 트랜잭션 이메일 발송 (Resend REST API). SDK 없이 fetch로 호출한다.
 * env 미설정이면 조용히 비활성(로그만).
 *
 * 필요한 env:
 *  - RESEND_API_KEY (필수)
 *  - RESEND_FROM (예: "STORYUP <noreply@storyup.me>", 기본값 동일). 도메인은 Resend에서 인증돼 있어야 함.
 */

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
}

/** 이메일 1건 발송. 성공 여부를 반환(미설정·실패 시 false). */
export async function sendEmail(input: EmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY 미설정 — 발송 생략");
    return false;
  }
  const from = process.env.RESEND_FROM || "STORYUP <noreply@storyup.me>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!res.ok) {
      console.error("[email] send failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send error", err);
    return false;
  }
}
