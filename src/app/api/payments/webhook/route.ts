import { NextResponse } from "next/server";
import { verifyPortoneWebhook } from "@/lib/payments/portone";
import { syncPayment } from "@/lib/payments/service";

export const maxDuration = 30;

/**
 * PortOne V2 웹훅.
 * - 서명(Standard Webhooks) 검증 실패 시 401.
 * - 페이로드는 신뢰하지 않는다: paymentId만 꺼내 PortOne API로 재검증(syncPayment).
 * - 중복/순서 뒤바뀐 전달은 syncPayment의 멱등성이 흡수한다.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const valid = verifyPortoneWebhook(rawBody, {
    id: request.headers.get("webhook-id"),
    timestamp: request.headers.get("webhook-timestamp"),
    signature: request.headers.get("webhook-signature"),
  });
  if (!valid) {
    console.warn("[payments/webhook] invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let paymentId = "";
  let type = "";
  try {
    const body = JSON.parse(rawBody) as {
      type?: string;
      data?: { paymentId?: string };
      // V1 호환 필드
      payment_id?: string;
    };
    type = body.type ?? "";
    paymentId = body.data?.paymentId ?? body.payment_id ?? "";
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  if (!paymentId) {
    console.warn("[payments/webhook] event without paymentId", type);
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 우리 주문 형식이 아닌 이벤트는 무시 (다른 서비스/테스트 이벤트)
  if (!paymentId.startsWith("su_")) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await syncPayment(paymentId);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (err) {
    console.error("[payments/webhook] sync failed", paymentId, err);
    // 5xx를 돌려주면 PortOne이 재시도한다.
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
