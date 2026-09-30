"use client";

import { useState, useTransition } from "react";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  connectDomainAction,
  disconnectDomainAction,
} from "@/app/dashboard/domain/actions";

interface DomainInfo {
  id: string;
  domain: string;
  status: "pending" | "active" | "error";
}
interface Item {
  businessId: string;
  name: string;
  published: boolean;
  domain: DomainInfo | null;
}

// Vercel 표준 DNS 타깃 (프로젝트가 Vercel에 호스팅됨).
const CNAME_TARGET = "cname.vercel-dns.com";
const A_TARGET = "76.76.21.21";

function StatusBadge({ status, ko }: { status: DomainInfo["status"]; ko: boolean }) {
  if (status === "active")
    return <Badge tone="success">{ko ? "연결됨" : "Connected"}</Badge>;
  if (status === "error")
    return <Badge tone="danger">{ko ? "오류" : "Error"}</Badge>;
  return <Badge tone="warning">{ko ? "검토 중" : "Pending"}</Badge>;
}

function DnsGuide({ domain, ko }: { domain: string; ko: boolean }) {
  const isApex = domain.split(".").length === 2; // myshop.com = apex, www.myshop.com = sub
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface-muted p-4 text-sm">
      <p className="font-medium">
        {ko ? "DNS 설정 안내" : "DNS setup"}
      </p>
      <p className="text-xs leading-relaxed text-muted">
        {ko
          ? "도메인 등록업체(가비아·후이즈·Cloudflare 등) DNS 설정에서 아래 레코드를 추가해주세요. 전파 후 STORYUP에서 검토해 활성화합니다."
          : "Add the record below at your domain registrar's DNS settings. We'll activate it after it propagates."}
      </p>
      <div className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs">
        {isApex ? (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-muted">Type</span>
              <span>A</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">Name</span>
              <span>@</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">Value</span>
              <span className="select-all">{A_TARGET}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-muted">Type</span>
              <span>CNAME</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">Name</span>
              <span>{domain.split(".")[0]}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">Value</span>
              <span className="select-all">{CNAME_TARGET}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BusinessRow({ item, ko }: { item: Item; ko: boolean }) {
  const [input, setInput] = useState("");
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [busy, start] = useTransition();

  const connect = () =>
    start(async () => {
      setNote(null);
      const res = await connectDomainAction(item.businessId, input);
      setNote({ text: res.error ?? res.message ?? "", error: !!res.error });
    });

  const disconnect = () => {
    if (
      !window.confirm(
        ko ? "이 도메인 연결을 해제할까요?" : "Remove this domain?",
      )
    )
      return;
    start(async () => {
      setNote(null);
      const res = await disconnectDomainAction(item.domain!.id);
      setNote({ text: res.error ?? res.message ?? "", error: !!res.error });
    });
  };

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{item.name}</p>
        {item.domain && (
          <StatusBadge status={item.domain.status} ko={ko} />
        )}
      </div>

      {!item.published && !item.domain && (
        <p className="text-xs text-muted">
          {ko
            ? "랜딩페이지를 먼저 공개해야 도메인 연결이 의미가 있어요."
            : "Publish your landing page first."}
        </p>
      )}

      {item.domain ? (
        <>
          <p className="font-mono text-sm">{item.domain.domain}</p>
          {item.domain.status === "pending" && (
            <DnsGuide domain={item.domain.domain} ko={ko} />
          )}
          {item.domain.status === "active" && (
            <a
              href={`https://${item.domain.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-primary underline"
            >
              {ko ? "사이트 열기" : "Open site"} →
            </a>
          )}
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={disconnect}
              disabled={busy}
            >
              {busy ? <Spinner className="size-4" /> : ko ? "연결 해제" : "Remove"}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="myshop.com"
            className="w-64"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <Button onClick={connect} disabled={busy || !input.trim()}>
            {busy ? <Spinner className="size-4" /> : ko ? "연결하기" : "Connect"}
          </Button>
        </div>
      )}

      {note && (
        <p className={`text-sm ${note.error ? "text-danger" : "text-primary"}`}>
          {note.text}
        </p>
      )}
    </Card>
  );
}

/** 사업장별 개인 도메인 연결 관리. */
export function CustomDomainManager({
  items,
  ko,
}: {
  items: Item[];
  ko: boolean;
}) {
  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted">
        {ko
          ? "먼저 사업장을 만들고 랜딩페이지를 공개해주세요."
          : "Create a business and publish a landing page first."}
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <BusinessRow key={item.businessId} item={item} ko={ko} />
      ))}
    </div>
  );
}
