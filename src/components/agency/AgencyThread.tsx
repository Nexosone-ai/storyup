"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { sendMessageAction, createQuoteAction } from "@/app/agency/actions";

interface Inquiry {
  id: string;
  serviceLabel: string;
  status: string;
  partnerUserId: string | null;
}
interface Msg {
  id: string;
  senderUserId: string;
  body: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  open: "문의 접수",
  quoted: "견적 발행됨",
  paid: "결제 완료",
  in_progress: "진행중",
  done: "완료",
  cancelled: "취소",
};

export function AgencyThread({
  inquiry,
  messages,
  meId,
  isPartnerView,
  supplyPriceKrw,
  ko,
}: {
  inquiry: Inquiry;
  messages: Msg[];
  meId: string;
  isPartnerView: boolean;
  supplyPriceKrw: number;
  ko: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [price, setPrice] = useState(supplyPriceKrw);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () => {
    const body = text.trim();
    if (!body) return;
    start(async () => {
      setError(null);
      const res = await sendMessageAction(inquiry.id, body);
      if (res.error) setError(res.error);
      else {
        setText("");
        router.refresh();
      }
    });
  };

  const issueQuote = () =>
    start(async () => {
      setError(null);
      const res = await createQuoteAction(inquiry.id, price);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  const margin = Math.max(0, price - supplyPriceKrw);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          {inquiry.serviceLabel}
        </h1>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
          {STATUS_LABEL[inquiry.status] ?? inquiry.status}
        </span>
      </div>

      {/* 파트너 견적 발행 */}
      {isPartnerView && inquiry.status !== "paid" && (
        <div className="rounded-2xl border border-primary/30 bg-primary-soft/20 p-4">
          <h2 className="text-sm font-semibold">견적 발행(결제코드)</h2>
          <p className="mt-1 text-xs text-muted">
            공급가{" "}
            <strong className="text-foreground">
              {supplyPriceKrw.toLocaleString()}원
            </strong>{" "}
            위에 마진을 붙여 클라이언트 가격을 제안하세요.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted">
              클라이언트 가격(원)
              <input
                type="number"
                min={supplyPriceKrw}
                step={10000}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="mt-1 block w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <span className="pb-2 text-xs text-muted">
              내 마진{" "}
              <strong className="text-primary">
                {margin.toLocaleString()}원
              </strong>
            </span>
            <Button size="sm" onClick={issueQuote} disabled={pending}>
              결제코드 발행
            </Button>
          </div>
        </div>
      )}

      {/* 대화 */}
      <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">
            아직 대화가 없습니다.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.senderUserId === meId;
          return (
            <div
              key={m.id}
              className={mine ? "flex justify-end" : "flex justify-start"}
            >
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm border border-border bg-surface-muted/40 text-foreground"
                }`}
              >
                {m.body}
              </p>
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={ko ? "메시지를 입력하세요…" : "Type a message…"}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <Button onClick={send} disabled={pending || !text.trim()}>
          전송
        </Button>
      </div>
    </div>
  );
}
