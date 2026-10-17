"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import {
  executeAgentProposal,
  rejectAgentProposal,
} from "@/app/business/[id]/agent/actions";

interface Proposal {
  id: string;
  action: string;
  summary: string;
  status: "pending" | "done" | "rejected" | "failed";
  resultHref?: string;
  resultLabel?: string;
}
interface Msg {
  key: string;
  role: "user" | "assistant";
  text: string;
  proposals?: Proposal[];
}

/**
 * Pro 사업주용 AI 에이전트 채팅(비스트리밍). 메시지 전송 → 서버 도구 루프 →
 * 응답 + 제안 카드. 제안은 승인/거절 버튼으로 실행(서버 액션, 중복 실행 방지).
 */
export function AgentChat({
  businessId,
  ko,
}: {
  businessId: string;
  ko: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const key = () => Math.random().toString(36).slice(2);

  const scrollToEnd = () =>
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
    );

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setMsgs((m) => [...m, { key: key(), role: "user", text }]);
    setBusy(true);

    // 스트리밍 응답을 채워 넣을 빈 assistant 버블을 먼저 추가.
    const aKey = key();
    setMsgs((m) => [...m, { key: aKey, role: "assistant", text: "", proposals: [] }]);
    const patch = (fn: (prev: Msg) => Msg) =>
      setMsgs((m) => m.map((x) => (x.key === aKey ? fn(x) : x)));

    try {
      const res = await fetch(`/api/business/${businessId}/agent/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });
      // 스트림 시작 전 오류는 JSON으로 온다.
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? (ko ? "오류가 발생했어요." : "Something went wrong."));
        setMsgs((m) => m.filter((x) => x.key !== aKey));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let evt: {
            type: string;
            text?: string;
            error?: string;
            conversationId?: string;
            proposals?: { id: string; action: string; summary: string }[];
          };
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (evt.type === "delta") {
            acc += evt.text ?? "";
            patch((x) => ({ ...x, text: acc }));
            scrollToEnd();
          } else if (evt.type === "proposals") {
            const props = (evt.proposals ?? []).map((p) => ({
              ...p,
              status: "pending" as const,
            }));
            patch((x) => ({ ...x, proposals: props }));
          } else if (evt.type === "done") {
            if (typeof evt.text === "string") {
              acc = evt.text;
              patch((x) => ({ ...x, text: acc }));
            }
            setConversationId(evt.conversationId ?? conversationId);
          } else if (evt.type === "error") {
            setError(evt.error ?? (ko ? "오류가 발생했어요." : "Error."));
          }
        }
      }
      // 아무 텍스트도 못 받았으면 빈 버블 제거.
      if (!acc.trim()) setMsgs((m) => m.filter((x) => x.key !== aKey));
    } catch {
      setError(ko ? "네트워크 오류가 발생했어요." : "Network error.");
      setMsgs((m) => m.filter((x) => x.key !== aKey));
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  };

  const setProposal = (id: string, patch: Partial<Proposal>) =>
    setMsgs((m) =>
      m.map((msg) =>
        msg.proposals
          ? {
              ...msg,
              proposals: msg.proposals.map((p) =>
                p.id === id ? { ...p, ...patch } : p,
              ),
            }
          : msg,
      ),
    );

  const approve = (p: Proposal) => {
    startTransition(async () => {
      const res = await executeAgentProposal(p.id);
      if (res.error) {
        setProposal(p.id, { status: "failed" });
        setError(res.error);
        return;
      }
      const r = res.result ?? {};
      let href: string | undefined;
      let label: string | undefined;
      if (typeof r.postId === "string") {
        href = `/business/${businessId}/blog/${r.postId}`;
        label = ko ? "초안 열기" : "Open draft";
      } else if ("cardNewsId" in r) {
        href = `/business/${businessId}/marketing#card-news`;
        label = ko ? "카드뉴스 열기" : "Open card news";
      }
      setProposal(p.id, { status: "done", resultHref: href, resultLabel: label });
    });
  };

  const reject = (p: Proposal) => {
    startTransition(async () => {
      await rejectAgentProposal(p.id);
      setProposal(p.id, { status: "rejected" });
    });
  };

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {msgs.length === 0 && (
          <div className="mx-auto mt-10 max-w-md text-center text-sm text-muted">
            <Icon.chat className="mx-auto mb-3 size-8 text-muted" />
            {ko
              ? "무엇을 도와드릴까요? 예: “이번 주 블로그 글 하나 써줘”, “최근 글로 카드뉴스 만들어줘”, “우리 매장은 평일 할인 중이야(기억해줘)”."
              : "How can I help? e.g. “write a blog post for this week”, “make card news from my latest post”."}
          </div>
        )}
        {msgs.map((m) => (
          <div
            key={m.key}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                  : "max-w-[85%] space-y-2"
              }
            >
              <p
                className={
                  m.role === "user"
                    ? "whitespace-pre-wrap"
                    : "whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-border bg-surface-muted/50 px-4 py-2.5 text-sm text-foreground"
                }
              >
                {m.text}
              </p>
              {m.proposals?.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-primary/30 bg-primary-soft/30 p-3 text-sm"
                >
                  <p className="font-medium text-foreground">{p.summary}</p>
                  {p.status === "pending" ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => approve(p)}
                        disabled={pending}
                      >
                        {ko ? "승인·실행" : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reject(p)}
                        disabled={pending}
                      >
                        {ko ? "거절" : "Reject"}
                      </Button>
                    </div>
                  ) : p.status === "done" ? (
                    <p className="mt-1.5 text-xs font-semibold text-primary">
                      {ko ? "완료됨" : "Done"}
                      {p.resultHref && (
                        <a
                          href={p.resultHref}
                          className="ml-2 underline underline-offset-2"
                        >
                          {p.resultLabel ?? (ko ? "열기" : "Open")}
                        </a>
                      )}
                    </p>
                  ) : p.status === "rejected" ? (
                    <p className="mt-1.5 text-xs text-muted">
                      {ko ? "거절됨" : "Rejected"}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-danger">
                      {ko ? "실패" : "Failed"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {busy &&
          (() => {
            const last = msgs[msgs.length - 1];
            const waiting = !last || last.role !== "assistant" || !last.text;
            return waiting ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Spinner className="size-4" />
                {ko ? "생각하는 중..." : "Thinking..."}
              </div>
            ) : null;
          })()}
      </div>

      {error && (
        <p className="border-t border-border bg-danger/5 px-4 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={ko ? "메시지를 입력하세요…" : "Type a message…"}
          disabled={busy}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
        />
        <Button onClick={() => void send()} disabled={busy || !input.trim()}>
          {ko ? "전송" : "Send"}
        </Button>
      </div>
    </div>
  );
}
