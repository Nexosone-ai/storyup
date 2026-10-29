"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PortOne from "@portone/browser-sdk/v2";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { formatPhone } from "@/utils/phone";
import { createInvoiceOrderAction } from "@/app/pay/actions";

/**
 * 파트너 상품 청구서 카드 결제 — 금액 결정·검증은 서버(청구서)에서. 브라우저 금액 미신뢰.
 * 입금(무통장)은 별도 '문의하기'로 안내(이번 범위 아님).
 */
export function InvoiceCheckout({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [method, setMethod] = useState<"card" | "easy">("card");

  const pay = () =>
    start(async () => {
      setNote(null);
      const buyer = { name: name.trim(), email: email.trim(), phone };
      const { order, error } = await createInvoiceOrderAction(token, buyer);
      if (error || !order) {
        setNote(error ?? "결제를 시작하지 못했습니다.");
        return;
      }
      try {
        const res = await PortOne.requestPayment({
          storeId: order.storeId,
          channelKey: order.channelKey,
          paymentId: order.orderId,
          orderName: order.orderName,
          totalAmount: order.amount,
          currency: "KRW",
          payMethod: method === "easy" ? "EASY_PAY" : "CARD",
          redirectUrl: `${window.location.origin}/invoices/${token}/result`,
          customer: {
            fullName: buyer.name,
            phoneNumber: buyer.phone.replace(/[^0-9]/g, ""),
            email: buyer.email,
          },
        });
        if (res?.code) {
          setNote(res.message ?? "결제가 완료되지 않았습니다.");
          return;
        }
        router.push(
          `/invoices/${token}/result?paymentId=${encodeURIComponent(order.orderId)}`,
        );
      } catch {
        setNote("결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(["card", "easy"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            disabled={busy}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
              method === m
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-muted hover:border-primary/50"
            }`}
          >
            {m === "card" ? "카드" : "간편결제"}
          </button>
        ))}
      </div>
      <div>
        <Label htmlFor="inv-name" required>
          이름
        </Label>
        <Input
          id="inv-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="홍길동"
          autoComplete="name"
        />
      </div>
      <div>
        <Label htmlFor="inv-phone" required>
          휴대폰 번호
        </Label>
        <Input
          id="inv-phone"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="010-1234-5678"
          autoComplete="tel"
          maxLength={13}
        />
      </div>
      <div>
        <Label htmlFor="inv-email" required>
          이메일
        </Label>
        <Input
          id="inv-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <p className="mt-1 text-xs text-muted">결제 영수증이 이메일로 발송됩니다.</p>
      </div>
      {note && <p className="text-sm text-danger">{note}</p>}
      <Button className="w-full" onClick={pay} disabled={busy}>
        {busy ? (
          <Spinner className="size-4" />
        ) : method === "easy" ? (
          "간편결제로 결제하기"
        ) : (
          "카드로 결제하기"
        )}
      </Button>
    </div>
  );
}
