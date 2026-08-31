import { createHmac, timingSafeEqual } from "crypto";

/**
 * PortOne V2 REST 연동 (PG: Toss Payments 채널).
 * SDK 대신 얇은 fetch 래퍼 — 프로바이더 교체/추가 시 이 모듈만 갈아끼운다.
 * 시크릿은 서버 전용 환경변수로만 읽는다.
 */

const API_BASE = "https://api.portone.io";

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

export interface PortonePayment {
  /** PortOne 결제 상태: READY | PAID | FAILED | CANCELLED | PARTIAL_CANCELLED | PAY_PENDING | VIRTUAL_ACCOUNT_ISSUED */
  status: string;
  id: string; // paymentId (= 우리 order_id)
  transactionId?: string;
  orderName?: string;
  method?: { type?: string } & Record<string, unknown>;
  amount?: { total?: number; paid?: number; cancelled?: number };
  currency?: string;
  customer?: { id?: string } & Record<string, unknown>;
  customData?: string;
  [key: string]: unknown;
}

function apiSecret(): string {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret)
    throw new PaymentProviderError("PORTONE_API_SECRET이 설정되지 않았습니다.");
  return secret;
}

/** 결제 단건 조회 — 서버 측 검증의 근거 데이터. */
export async function getPortonePayment(
  paymentId: string,
): Promise<PortonePayment> {
  const res = await fetch(
    `${API_BASE}/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: { Authorization: `PortOne ${apiSecret()}` },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new PaymentProviderError(
      `결제 조회 실패 (${res.status})`,
      res.status,
      await res.text().catch(() => undefined),
    );
  }
  return (await res.json()) as PortonePayment;
}

/** 결제 취소(환불). 전액 취소 기본. */
export async function cancelPortonePayment(
  paymentId: string,
  reason: string,
  amount?: number,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `PortOne ${apiSecret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(amount ? { reason, amount } : { reason }),
    },
  );
  if (!res.ok) {
    throw new PaymentProviderError(
      `결제 취소 실패 (${res.status})`,
      res.status,
      await res.text().catch(() => undefined),
    );
  }
}

/**
 * PortOne V2 웹훅 서명 검증 (Standard Webhooks 규격).
 * headers: webhook-id, webhook-timestamp, webhook-signature ("v1,<base64>")
 * secret: PORTONE_WEBHOOK_SECRET ("whsec_..." — base64 키)
 */
export function verifyPortoneWebhook(
  rawBody: string,
  headers: { id?: string | null; timestamp?: string | null; signature?: string | null },
): boolean {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) return false;
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  // 5분 이상 지난 이벤트는 리플레이로 간주
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300)
    return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  // "v1,sig1 v1,sig2" 형태 — 하나라도 일치하면 유효
  return signature.split(" ").some((part) => {
    const sig = part.startsWith("v1,") ? part.slice(3) : part;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
