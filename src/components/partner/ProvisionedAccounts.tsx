"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import {
  createProvisionedAccountAction,
  extendProvisionedAccountAction,
} from "@/app/partner/actions";
import type { ProvisionedAccountRow } from "@/lib/partner/provisioning";

/**
 * 별도계약 파트너 — 고객 계정 직접 생성(Lite) + 30일 연장.
 * 계정 1개 = 30일 이용권 = Lite 계정 작업권 1개(고객 결제·관리자 부여로 생김, 2026-11-11).
 */
export function ProvisionedAccounts({
  accounts,
  remaining,
  limits,
  ko = true,
}: {
  accounts: ProvisionedAccountRow[];
  /** 보유 Lite 계정 작업권(개). */
  remaining: number;
  limits: { sites: number; blogPosts: number; cardNews: number; shorts: number };
  ko?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canAfford = remaining >= 1;

  const create = () => {
    setMsg(null);
    setError(null);
    if (!email.trim() || !name.trim() || password.length < 8) {
      setError(ko ? "이메일·이름·초기 비밀번호(8자 이상)를 입력해주세요." : "Fill email, name and a password (8+ chars).");
      return;
    }
    if (
      !window.confirm(
        ko
          ? `${email.trim()} 계정을 만들까요?\n\nLite 계정 작업권 1개가 사용됩니다(보유 ${remaining}개).`
          : `Create ${email.trim()}? Uses 1 Lite account credit (${remaining} left).`,
      )
    )
      return;
    start(async () => {
      const res = await createProvisionedAccountAction({ email, displayName: name, password });
      if (res.error) setError(res.error);
      else {
        setMsg(res.message ?? null);
        setEmail("");
        setName("");
        setPassword("");
        router.refresh();
      }
    });
  };

  const extend = (clientUserId: string, label: string) => {
    setMsg(null);
    setError(null);
    if (
      !window.confirm(
        ko
          ? `${label} 이용권을 30일 연장할까요? Lite 계정 작업권 1개가 사용됩니다.`
          : `Extend ${label} by 30 days? Uses 1 Lite account credit.`,
      )
    )
      return;
    start(async () => {
      const res = await extendProvisionedAccountAction(clientUserId);
      if (res.error) setError(res.error);
      else {
        setMsg(res.message ?? null);
        router.refresh();
      }
    });
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Icon.plus className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">
          {ko ? "고객 계정 직접 생성 (별도계약 · Lite)" : "Create client accounts (contract · Lite)"}
        </h2>
        <span className="ml-auto text-xs text-muted">
          {ko ? "Lite 계정 작업권" : "Lite credits"} <b className="tabular-nums">{remaining}</b>{ko ? "개" : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        {ko
          ? `고객이 가입할 필요 없이 파트너가 계정을 바로 만듭니다. 계정 1개 = 30일 이용권 = Lite 계정 작업권 1개 · 랜딩 ${limits.sites}개 · 블로그 ${limits.blogPosts}건/월 · 카드뉴스 ${limits.cardNews}건/월 · 카드뉴스 쇼츠 ${limits.shorts}편/월. 생성 즉시 내 고객(대행)으로 연결됩니다.`
          : `Create accounts directly. One account = 30 days = 1 Lite account credit · ${limits.sites} landing · ${limits.blogPosts} blog posts/mo · ${limits.cardNews} card news/mo · ${limits.shorts} shorts/mo.`}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div>
          <Label required>{ko ? "아이디(이메일)" : "Email"}</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" autoComplete="off" />
        </div>
        <div>
          <Label required>{ko ? "표시 이름(상호)" : "Display name"}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={ko ? "예: 행복한 카페" : "e.g. Happy Cafe"} autoComplete="off" />
        </div>
        <div>
          <Label required>{ko ? "초기 비밀번호(8자 이상)" : "Initial password (8+)"}</Label>
          <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={create} disabled={busy || !canAfford}>
          {busy
            ? ko ? "처리 중…" : "Working…"
            : ko ? "계정 만들기 (작업권 1개 사용)" : "Create (1 credit)"}
        </Button>
        {!canAfford && (
          <span className="text-xs text-danger">
            {ko ? "Lite 계정 작업권이 없어요. " : "No Lite credits left. "}
            <a href="/partner/sales" className="underline">
              {ko ? "고객에게 상품을 판매(결제)하면 작업권이 생겨요" : "Sell a product to earn credits"}
            </a>
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {ko
          ? "초기 비밀번호는 저장되지 않으니 고객에게 직접 전달하고, 첫 로그인 후 변경하도록 안내하세요."
          : "The initial password is not stored; hand it to the client and ask them to change it."}
      </p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}

      {accounts.length > 0 && (
        <ul className="mt-4 divide-y divide-border text-sm">
          {accounts.map((a) => {
            const left = a.daysLeft;
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{a.displayName ?? a.email}</span>
                  {a.displayName && <span className="ml-1 text-xs text-muted">{a.email}</span>}
                  <span className={`ml-2 text-xs ${a.active && left > 7 ? "text-muted" : "text-danger"}`}>
                    {a.active
                      ? ko ? `${fmt(a.expiresAt)}까지 (D-${Math.max(0, left)})` : `until ${fmt(a.expiresAt)} (D-${Math.max(0, left)})`
                      : ko ? `만료 ${fmt(a.expiresAt)}` : `expired ${fmt(a.expiresAt)}`}
                    {" · "}
                    {ko ? `사업장 ${a.businessCount}` : `${a.businessCount} biz`}
                    {" · "}
                    {ko ? `이용권 ${a.periods}회` : `${a.periods} periods`}
                  </span>
                </span>
                <Button size="sm" variant="outline" disabled={busy || !canAfford} onClick={() => extend(a.clientUserId, a.displayName ?? a.email)}>
                  {ko ? "30일 연장 (작업권 1개)" : "Extend 30d (1 credit)"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
