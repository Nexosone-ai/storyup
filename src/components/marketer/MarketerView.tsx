"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  addDownstreamMemberAction,
  setMySplitAction,
} from "@/app/dashboard/marketer/actions";

type Role = "distributor" | "agency" | "reseller";

const ROLE_LABEL: Record<Role, string> = {
  distributor: "총판",
  agency: "영업점",
  reseller: "리셀러",
};
const CHILD_LABEL: Record<Role, string | null> = {
  distributor: "영업점",
  agency: "리셀러",
  reseller: null,
};

interface Split {
  distributor: number;
  agency: number;
  reseller: number;
}
interface Person {
  userId: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  childCount: number;
}
interface ClientItem {
  userId: string;
  name: string;
  email: string;
  plan: string;
  paying: boolean;
}
interface RateView {
  itemType: "subscription_plan" | "product";
  itemKey: string;
  label: string;
  ratePct: number;
  active: boolean;
}
interface CommissionItem {
  id: string;
  occurredAt: string;
  sourceType: string;
  itemLabel: string;
  role: string;
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
}

const C_STATUS: Record<
  string,
  { label: string; tone: "success" | "muted" | "warning" }
> = {
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
  role,
  status,
  split,
  upline,
  rates,
  downline,
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
  role: Role;
  status: string;
  split: Split;
  upline: { name: string; email: string; role: Role } | null;
  rates: RateView[];
  downline: Person[];
  clients: ClientItem[];
  monthRevenue: number;
  monthCommission: number;
  totalCommission: number;
  paidCommission: number;
  recent: CommissionItem[];
  settlements: SettlementItem[];
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const signupLink = code ? `${siteUrl}/?ref=${code}` : "";
  const childLabel = CHILD_LABEL[role];

  // 총판 배분비율 편집 상태
  const [sd, setSd] = useState(String(split.distributor));
  const [sa, setSa] = useState(String(split.agency));
  const [sr, setSr] = useState(String(split.reseller));
  const splitSum = Number(sd) + Number(sa) + Number(sr);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  };

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote(res.error ?? res.message ?? null);
      if (!res.error) {
        setAddEmail("");
        router.refresh();
      }
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ROLE_LABEL[role]} 대시보드
          </h1>
          <p className="mt-1 text-sm text-muted">
            내 실적과 수당을 확인하고, 추천 링크로 영업하세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={role === "distributor" ? "success" : "default"}>
            {ROLE_LABEL[role]}
          </Badge>
          {status !== "active" && <Badge tone="muted">정지됨</Badge>}
        </div>
      </div>

      {note && <p className="text-sm text-primary">{note}</p>}

      {/* 요약 카드 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">이번달 수당</p>
          <p className="tnum mt-1 text-2xl font-bold">{won(monthCommission)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">이번달 매출(연결)</p>
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

      {/* 상위(업라인) */}
      {upline && (
        <Card className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span className="text-muted">상위 {ROLE_LABEL[upline.role]}: </span>
            <span className="font-medium">{upline.name}</span>
            <span className="ml-1 text-xs text-muted">{upline.email}</span>
          </p>
        </Card>
      )}

      {/* 총판: 배분비율 설정 */}
      {role === "distributor" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">수당 배분비율</h2>
          <p className="text-xs text-muted">
            관리자가 설정한 지급률(판매액 대비 %)로 만들어진 수당 풀을, 총판·영업점·리셀러에게
            나누는 비율입니다. 합계가 100%가 되어야 합니다. 리셀러가 직접 판매하면 이 비율대로
            나뉘고, 영업점이 직접 판매하면 리셀러 몫까지 영업점이, 총판이 직접 판매하면 전액을
            총판이 받습니다.
          </p>
          <Card className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">총판 %</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={sd}
                onChange={(e) => setSd(e.target.value)}
                className="w-24 text-right"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">영업점 %</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={sa}
                onChange={(e) => setSa(e.target.value)}
                className="w-24 text-right"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">리셀러 %</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={sr}
                onChange={(e) => setSr(e.target.value)}
                className="w-24 text-right"
              />
            </label>
            <span
              className={`text-sm ${splitSum === 100 ? "text-muted" : "text-danger"}`}
            >
              합계 {splitSum}%
            </span>
            <Button
              size="sm"
              disabled={busy || splitSum !== 100}
              onClick={() =>
                run(() => setMySplitAction(Number(sd), Number(sa), Number(sr)))
              }
            >
              {busy ? <Spinner className="size-4" /> : "저장"}
            </Button>
          </Card>
          {rates.length > 0 && (
            <Card className="space-y-1.5">
              <p className="text-xs text-muted">내 지급률 (관리자 설정)</p>
              {rates.map((r) => (
                <div
                  key={`${r.itemType}:${r.itemKey}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{r.label}</span>
                  <span className="tnum font-medium">
                    {r.active ? `${r.ratePct}%` : "미설정"}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}

      {/* 추천 링크 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">내 추천 링크</h2>
        {code ? (
          <Card className="space-y-3">
            <div>
              <p className="text-xs text-muted">추천 코드</p>
              <p className="font-mono text-lg font-bold tracking-widest">
                {code}
              </p>
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
              이 링크로 가입한 고객이 구독하면 네트워크에 수당이 배분됩니다. 상품 결제링크로 영업할
              때는 링크 뒤에 <b>?ref={code}</b> 를 붙이면 해당 구매도 내 실적으로 연결됩니다.
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

      {/* 하위 멤버 */}
      {childLabel && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            내 {childLabel} ({downline.length})
          </h2>
          <Card className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-muted">
                {childLabel} 이메일 (가입된 사용자)
              </label>
              <Input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <Button
              disabled={busy || !addEmail.trim()}
              onClick={() => run(() => addDownstreamMemberAction(addEmail))}
            >
              {busy ? <Spinner className="size-4" /> : `${childLabel} 등록`}
            </Button>
          </Card>
          {downline.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="p-3">{childLabel}</th>
                    <th className="p-3">역할</th>
                    {role === "distributor" && (
                      <th className="p-3 text-right">리셀러 수</th>
                    )}
                    <th className="p-3">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {downline.map((m) => (
                    <tr
                      key={m.userId}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="p-3">
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted">{m.email}</p>
                      </td>
                      <td className="p-3">{ROLE_LABEL[m.role]}</td>
                      {role === "distributor" && (
                        <td className="tnum p-3 text-right">{m.childCount}</td>
                      )}
                      <td className="p-3">
                        <Badge tone={m.status === "active" ? "success" : "muted"}>
                          {m.status === "active" ? "활성" : "정지"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 내 클라이언트 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          내 추천 고객 ({clients.length})
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
                  <tr
                    key={c.userId}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="p-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted">{c.email}</p>
                    </td>
                    <td className="p-3 uppercase">{c.plan}</td>
                    <td className="p-3">
                      {c.paying ? (
                        <Badge tone="success">정기결제 중</Badge>
                      ) : (
                        <Badge tone="muted">체험/무료</Badge>
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
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="p-3">일시</th>
                  <th className="p-3">상품/플랜</th>
                  <th className="p-3">역할</th>
                  <th className="p-3 text-right">매출</th>
                  <th className="p-3 text-right">수당</th>
                  <th className="p-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="p-3 whitespace-nowrap">
                      {fmtDate(c.occurredAt)}
                    </td>
                    <td className="p-3">
                      {c.itemLabel}
                      <span className="ml-1 text-xs text-muted">
                        ({c.sourceType === "subscription" ? "구독" : "상품"})
                      </span>
                    </td>
                    <td className="p-3">
                      {ROLE_LABEL[(c.role as Role)] ?? c.role}
                    </td>
                    <td className="tnum p-3 text-right">{won(c.gross)}</td>
                    <td className="tnum p-3 text-right font-medium">
                      {won(c.amount)}
                    </td>
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
                  <tr
                    key={s.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="p-3 whitespace-nowrap">{s.period}</td>
                    <td className="tnum p-3 text-right">{won(s.gross)}</td>
                    <td className="tnum p-3 text-right text-muted">
                      {s.tax > 0 ? `-${won(s.tax)}` : "-"}
                    </td>
                    <td className="tnum p-3 text-right font-medium">
                      {won(s.net)}
                    </td>
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
