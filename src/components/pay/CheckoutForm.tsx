"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PortOne from "@portone/browser-sdk/v2";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { createProductOrderAction } from "@/app/pay/actions";

/** 공개 결제 — 로그인 없이 이름·연락처만 입력 후 카드 결제. 금액 결정·검증은 서버에서. */
export function CheckoutForm({
  productId,
  slug,
  refCode,
}: {
  productId: string;
  slug: string;
  refCode?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const pay = () =>
    start(async () => {
      setNote(null);
      const buyer = { name: name.trim(), email: email.trim(), phone };
      // 1) 서버가 금액을 확정한 PENDING 주문 생성
      const { order, error } = await createProductOrderAction(
        productId,
        buyer,
        refCode,
      );
      if (error || !order) {
        setNote(error ?? "주문을 시작하지 못했습니다.");
        return;
      }
      // 2) 결제창 호출
      try {
        const res = await PortOne.requestPayment({
          storeId: order.storeId,
          channelKey: order.channelKey,
          paymentId: order.orderId,
          orderName: order.orderName,
          totalAmount: order.amount,
          currency: "KRW",
          payMethod: "CARD",
          // 모바일 등 리다이렉트 결제수단은 이 URL로 복귀해 서버에서 최종 검증한다.
          redirectUrl: `${window.location.origin}/pay/${slug}/result${
            refCode ? `?ref=${encodeURIComponent(refCode)}` : ""
          }`,
          customer: {
            fullName: buyer.name,
            phoneNumber: buyer.phone.replace(/[^0-9]/g, ""),
            email: buyer.email,
          },
        });
        // 팝업(데스크톱) 흐름: 여기서 resolve. code가 있으면 실패/취소.
        // (리다이렉트 흐름은 여기 도달 전에 result 페이지로 이동한다.)
        if (res?.code) {
          setNote(res.message ?? "결제가 완료되지 않았습니다.");
          return;
        }
        // 결과 페이지에서 서버가 PortOne API로 최종 검증한다.
        router.push(
          `/pay/${slug}/result?paymentId=${encodeURIComponent(order.orderId)}`,
        );
      } catch {
        setNote("결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    });

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="buyer-name">이름</Label>
        <Input
          id="buyer-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="홍길동"
          autoComplete="name"
        />
      </div>
      <div>
        <Label htmlFor="buyer-phone">휴대폰 번호</Label>
        <Input
          id="buyer-phone"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-1234-5678"
          autoComplete="tel"
        />
      </div>
      <div>
        <Label htmlFor="buyer-email">이메일</Label>
        <Input
          id="buyer-email"
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
        {busy ? <Spinner className="size-4" /> : "카드로 결제하기"}
      </Button>
    </div>
  );
}
