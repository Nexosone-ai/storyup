"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PortOne from "@portone/browser-sdk/v2";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { formatPhone } from "@/utils/phone";
import { createProductOrderAction } from "@/app/pay/actions";

/** 공개 결제 — 로그인 없이 이름·연락처만 입력 후 카드 결제. 금액 결정·검증은 서버에서. */
export function CheckoutForm({
  productId,
  slug,
  refCode,
  defaultName = "",
  defaultEmail = "",
}: {
  productId: string;
  slug: string;
  refCode?: string | null;
  /** 로그인 사용자면 가입 정보로 미리 채운다 */
  defaultName?: string;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // 결제 수단 — 카드 / 간편결제(카카오페이·네이버페이·페이코 등, PG 채널 계약분 노출)
  const [method, setMethod] = useState<"card" | "easy">("card");

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
          payMethod: method === "easy" ? "EASY_PAY" : "CARD",
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
      {/* 결제 수단 선택 — 카드 / 간편결제 */}
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
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="010-1234-5678"
          autoComplete="tel"
          maxLength={13}
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
