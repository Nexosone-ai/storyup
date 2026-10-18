"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  sendMessageAction,
  createQuoteAction,
  addDeliverableAction,
} from "@/app/agency/actions";

interface Inquiry {
  id: string;
  businessId: string;
  serviceKey: string;
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
interface Deliverable {
  id: string;
  kind: string;
  title: string | null;
  url: string;
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
  deliverables,
  ko,
}: {
  inquiry: Inquiry;
  messages: Msg[];
  meId: string;
  isPartnerView: boolean;
  supplyPriceKrw: number;
  deliverables: Deliverable[];
  ko: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [price, setPrice] = useState(supplyPriceKrw);
  const [dvTitle, setDvTitle] = useState("");
  const [dvUrl, setDvUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const deliver = () =>
    start(async () => {
      setError(null);
      const res = await addDeliverableAction({
        businessId: inquiry.businessId,
        inquiryId: inquiry.id,
        kind: "video",
        title: dvTitle,
        url: dvUrl,
      });
      if (res.error) setError(res.error);
      else {
        setDvTitle("");
        setDvUrl("");
        router.refresh();
      }
    });

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(url);
  };

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

      {/* 파트너: 산출물(영상) 전달 */}
      {isPartnerView && inquiry.status !== "cancelled" && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">작업물(영상) 전달</h2>
          <p className="mt-1 text-xs text-muted">
            완성 영상의 URL을 전달하면 고객이 영상 섹션에서 다운로드·사용할 수 있어요.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input
              value={dvTitle}
              onChange={(e) => setDvTitle(e.target.value)}
              placeholder="제목(예: 신메뉴 홍보 15초)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={dvUrl}
              onChange={(e) => setDvUrl(e.target.value)}
              placeholder="https://… 영상 URL"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <Button size="sm" onClick={deliver} disabled={pending || !dvUrl.trim()}>
              전달
            </Button>
          </div>
        </div>
      )}

      {/* 전달된 영상/산출물 — 고객 다운로드·사용 */}
      {deliverables.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">전달된 영상</h2>
          <ul className="mt-2 space-y-3">
            {deliverables.map((d) => (
              <li key={d.id} className="rounded-xl border border-border bg-background p-3">
                <p className="text-sm font-medium">{d.title ?? "영상"}</p>
                <video
                  src={d.url}
                  controls
                  className="mt-2 max-h-64 w-full rounded-lg bg-black"
                />
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <a
                    href={d.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    다운로드
                  </a>
                  <button
                    type="button"
                    onClick={() => copy(d.url)}
                    className="text-muted underline-offset-2 hover:text-primary hover:underline"
                  >
                    {copied === d.url ? "복사됨" : "링크 복사"}
                  </button>
                  <span className="text-muted">
                    랜딩·홈페이지·블로그·SNS 카드에 이 링크를 붙여 사용하세요.
                  </span>
                </div>
              </li>
            ))}
          </ul>
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
