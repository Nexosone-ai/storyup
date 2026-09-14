"use client";

import { useState } from "react";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Rank } from "@/lib/marketers";

interface Standing {
  rank: Rank;
  activeClients: number;
  toMaker: number;
}
interface ClientItem {
  userId: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  paying: boolean;
}
interface CommissionItem {
  id: string;
  occurredAt: string;
  sourceType: string;
  itemLabel: string;
  rank: string;
  gross: number;
  amount: number;
  status: string;
}
interface SettlementItem {
  id: string;
  period: string;
  gross: number;
  tax: number;
  net: number;
  count: number;
  status: string;
  payoutType: string;
}

const C_STATUS: Record<string, { label: string; tone: "success" | "muted" | "warning" }> = {
  pending: { label: "정산대기", tone: "warning" },
  settled: { label: "정산확정", tone: "muted" },
  paid: { label: "지급완료", tone: "success" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}
function won(n: number) {
  return `₩${n.toLocaleString()}`;
}

export function MarketerView({
  siteUrl,
  code,
  standing,
  clients,
  monthRevenue,
  monthCommission,
  totalCommission,
  paidCommission,
  recent,
  settlements,
}: {
  siteUrl: string;
  code: string | null;
  standing: Standing;
  clients: ClientItem[];
  monthRevenue: number;
  monthCommission: number;
  totalCommission: number;
  paidCommission: number;
  recent: CommissionItem[];
  settlements: SettlementItem[];
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const signupLink = code ? `${siteUrl}/?ref=${code}` : "";

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  };

  const isMaker = standing.rank === "MAKER";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">마케터 대시보드</h1>
          <p className="mt-1 text-sm text-muted">
            내 실적과 수당을 확인하고, 추천 링크로 영업하세요.
          </p>
        </div>
        <Badge tone={isMaker ? "success" : "default"}>
          {isMaker ? "🏆 MAKER" : "RESELLER"}
        </Badge>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">이번달 수당</p>
          <p className="tnum mt-1 text-2xl font-bold">{won(monthCommission)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">이번달 매출</p>
          <p className="tnum mt-1 text-2xl font-bold">{won(monthRevenue)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">누적 수당</p>
          <p className="tnum mt-1 text-2xl font-bold">{won(totalCommission)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">지급완료</p>
          <p className="tnum mt-1 text-2xl font-bold">{won(paidCommission)}</p>
        </Card>
      </div>

      {/* 직급 진행도 */}
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            직급: {isMaker ? "MAKER" : "RESELLER"}
          </p>
          <p className="text-sm text-muted">
            유지중 정기결제 클라이언트 {standing.activeClients}명
          </p>
        </div>
        {!isMaker && (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, (standing.activeClients / 10) * 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted">
              MAKER 승급까지 {standing.toMaker}명 남았습니다 (정기결제 10명 유지 시 MAKER).
            </p>
          </>
        )}
      </Card>

      {/* 추천 링크 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">내 추천 링크</h2>
        {code ? (
          <Card className="space-y-3">
            <div>
              <p className="text-xs text-muted">추천 코드</p>
              <p className="font-mono text-lg font-bold tracking-widest">{code}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-muted px-3 py-2 font-mono text-xs">
                {signupLink}
              </code>
              <Button size="sm" onClick={() => copy(signupLink, "signup")}>
                {copied === "signup" ? "복사됨 ✓" : "가입 링크 복사"}
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              이 링크로 가입한 고객이 구독하면 수당이 적립됩니다. 상품 결제링크로 영업할 때는
              링크 뒤에 <b>?ref={code}</b> 를 붙이면 해당 상품 구매도 내 실적으로 연결됩니다.
              <br />예: <span className="font-mono">{siteUrl}/pay/상품slug?ref={code}</span>
            </p>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-muted">
              추천 코드를 준비 중입니다. 잠시 후 새로고침 해주세요.
            </p>
          </Card>
        )}
      </section>

      {/* 내 클라이언트 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          내 클라이언트 ({clients.length})
        </h2>
        {clients.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            아직 내 링크로 가입한 고객이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="p-3">고객</th>
                  <th className="p-3">플랜</th>
                  <th className="p-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.userId} className="border-b border-border/60 last:border-0">
                    <td className="p-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted">{c.email}</p>
                    </td>
                    <td className="p-3 uppercase">{c.plan}</td>
                    <td className="p-3">
                      {c.paying ? (
                        <Badge tone="success">정기결제 중</Badge>
                      ) : (
                        <Badge tone="muted">{c.status === "active" ? "체험/무료" : "미결제"}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 수당 내역 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">수당 내역</h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            아직 적립된 수당이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="p-3">일시</th>
                  <th className="p-3">상품/플랜</th>
                  <th className="p-3">직급</th>
                  <th className="p-3 text-right">매출</th>
                  <th className="p-3 text-right">수당</th>
                  <th className="p-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 whitespace-nowrap">{fmtDate(c.occurredAt)}</td>
                    <td className="p-3">
                      {c.itemLabel}
                      <span className="ml-1 text-xs text-muted">
                        ({c.sourceType === "subscription" ? "구독" : "상품"})
                      </span>
                    </td>
                    <td className="p-3">{c.rank}</td>
                    <td className="tnum p-3 text-right">{won(c.gross)}</td>
                    <td className="tnum p-3 text-right font-medium">{won(c.amount)}</td>
                    <td className="p-3">
                      <Badge tone={C_STATUS[c.status]?.tone ?? "muted"}>
                        {C_STATUS[c.status]?.label ?? c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 정산 내역 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">정산 내역</h2>
        <p className="text-xs text-muted">
          매월 말 마감 후 다음달 10일에 지급됩니다. 프리랜서는 3.3% 원천징수 후 순액이 지급됩니다.
        </p>
        {settlements.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            아직 정산 내역이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="p-3">정산월</th>
                  <th className="p-3 text-right">수당합계</th>
                  <th className="p-3 text-right">원천징수</th>
                  <th className="p-3 text-right">실지급</th>
                  <th className="p-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 whitespace-nowrap">{s.period}</td>
                    <td className="tnum p-3 text-right">{won(s.gross)}</td>
                    <td className="tnum p-3 text-right text-muted">
                      {s.tax > 0 ? `-${won(s.tax)}` : "-"}
                    </td>
                    <td className="tnum p-3 text-right font-medium">{won(s.net)}</td>
                    <td className="p-3">
                      <Badge tone={s.status === "paid" ? "success" : "warning"}>
                        {s.status === "paid" ? "지급완료" : "정산중"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
