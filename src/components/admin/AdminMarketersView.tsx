"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  registerDistributorAction,
  setMemberStatusAction,
  setDistributorSplitAction,
  setDistributorRateAction,
  generateSettlementsAction,
  markSettlementPaidAction,
} from "@/app/dashboard/admin/actions";

type Split = { distributor: number; agency: number; reseller: number };

export interface AdminDistributorItem {
  userId: string;
  name: string;
  email: string;
  status: string;
  payoutType: string;
  split: Split;
  agencyCount: number;
  resellerCount: number;
  pendingCommission: number;
}
export interface RateTarget {
  itemType: "subscription_plan" | "product";
  itemKey: string;
  label: string;
  price: number | null;
}
export interface DistributorRateItem {
  distributorUserId: string;
  itemType: "subscription_plan" | "product";
  itemKey: string;
  ratePct: number;
  active: boolean;
}
export interface NetworkReferralItem {
  clientUserId: string;
  clientName: string;
  clientEmail: string;
  sellerName: string;
  sellerEmail: string;
  sellerRole: "distributor" | "agency" | "reseller";
  signupAt: string;
  plan: string;
  paying: boolean;
}
export interface SettlementItem {
  id: string;
  name: string;
  email: string;
  period: string;
  gross: number;
  tax: number;
  net: number;
  count: number;
  status: string;
  payoutType: string;
}

const ROLE_LABEL: Record<string, string> = {
  distributor: "총판",
  agency: "영업점",
  reseller: "리셀러",
};

function won(n: number) {
  return `₩${n.toLocaleString()}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------- 총판 관리 ----------------

function DistributorRow({
  d,
  busy,
  run,
}: {
  d: AdminDistributorItem;
  busy: boolean;
  run: (fn: () => Promise<{ error?: string; message?: string }>) => void;
}) {
  const [sd, setSd] = useState(String(d.split.distributor));
  const [sa, setSa] = useState(String(d.split.agency));
  const [sr, setSr] = useState(String(d.split.reseller));
  const sum = Number(sd) + Number(sa) + Number(sr);

  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="p-3">
        <p className="font-medium">{d.name}</p>
        <p className="text-xs text-muted">{d.email}</p>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={100}
            value={sd}
            onChange={(e) => setSd(e.target.value)}
            className="w-14 text-right"
            title="총판"
          />
          <span className="text-xs text-muted">:</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={sa}
            onChange={(e) => setSa(e.target.value)}
            className="w-14 text-right"
            title="영업점"
          />
          <span className="text-xs text-muted">:</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={sr}
            onChange={(e) => setSr(e.target.value)}
            className="w-14 text-right"
            title="리셀러"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || sum !== 100}
            onClick={() =>
              run(() =>
                setDistributorSplitAction(
                  d.userId,
                  Number(sd),
                  Number(sa),
                  Number(sr),
                ),
              )
            }
          >
            저장
          </Button>
        </div>
        <p
          className={`mt-1 text-[11px] ${sum === 100 ? "text-muted" : "text-danger"}`}
        >
          총판:영업점:리셀러 합계 {sum}%
        </p>
      </td>
      <td className="tnum p-3 text-right text-xs">
        {d.agencyCount} / {d.resellerCount}
      </td>
      <td className="tnum p-3 text-right">{won(d.pendingCommission)}</td>
      <td className="p-3">
        <Badge tone={d.status === "active" ? "success" : "muted"}>
          {d.status === "active" ? "활성" : "정지"}
        </Badge>
      </td>
      <td className="p-3">
        {d.status === "active" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => run(() => setMemberStatusAction(d.userId, "suspended"))}
          >
            강등(정지)
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => run(() => setMemberStatusAction(d.userId, "active"))}
          >
            활성화
          </Button>
        )}
      </td>
    </tr>
  );
}

export function AdminDistributors({
  distributors,
}: {
  distributors: AdminDistributorItem[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [email, setEmail] = useState("");
  const [payoutType, setPayoutType] = useState<"freelancer" | "business">(
    "freelancer",
  );
  const [note, setNote] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote(res.error ?? res.message ?? null);
      if (!res.error) router.refresh();
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">총판 관리</h2>
      <p className="text-xs text-muted">
        유저를 총판으로 등록하면 네트워크 대시보드가 열리고, 총판이 영업점을, 영업점이 리셀러를 등록할
        수 있습니다. 배분비율은 총판:영업점:리셀러 순이며 합계 100%여야 합니다. “강등(정지)”하면 해당
        총판 조직의 신규 수당 적립이 중단됩니다.
      </p>
      {note && <p className="text-sm text-primary">{note}</p>}

      <Card className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs text-muted">이메일</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">정산 유형</label>
          <Select
            value={payoutType}
            onChange={(e) =>
              setPayoutType(e.target.value as "freelancer" | "business")
            }
            className="w-36"
          >
            <option value="freelancer">프리랜서(3.3%)</option>
            <option value="business">사업자(계산서)</option>
          </Select>
        </div>
        <Button
          onClick={() => run(() => registerDistributorAction(email, payoutType))}
          disabled={busy || !email.trim()}
        >
          {busy ? <Spinner className="size-4" /> : "총판 등록"}
        </Button>
      </Card>

      {distributors.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="p-3">총판</th>
                <th className="p-3">배분비율(총판:영업점:리셀러)</th>
                <th className="p-3 text-right">영업점/리셀러</th>
                <th className="p-3 text-right">미정산 수당</th>
                <th className="p-3">상태</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {distributors.map((d) => (
                <DistributorRow key={d.userId} d={d} busy={busy} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------- 총판별 지급률 ----------------

export function AdminDistributorRates({
  distributors,
  targets,
  rates,
}: {
  distributors: AdminDistributorItem[];
  targets: RateTarget[];
  rates: DistributorRateItem[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [distId, setDistId] = useState(distributors[0]?.userId ?? "");

  // key: distId:itemType:itemKey -> ratePct(active면)
  const rateMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rates)
      m.set(
        `${r.distributorUserId}:${r.itemType}:${r.itemKey}`,
        r.active ? r.ratePct : 0,
      );
    return m;
  }, [rates]);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const valOf = (t: RateTarget) => {
    const key = `${distId}:${t.itemType}:${t.itemKey}`;
    return edits[key] ?? String(rateMap.get(key) ?? 0);
  };
  const setVal = (t: RateTarget, v: string) =>
    setEdits((p) => ({
      ...p,
      [`${distId}:${t.itemType}:${t.itemKey}`]: v,
    }));

  const save = (t: RateTarget) =>
    start(async () => {
      setNote(null);
      const pct = Number(valOf(t));
      const res = await setDistributorRateAction(
        distId,
        t.itemType,
        t.itemKey,
        pct,
        pct > 0,
      );
      setNote(res.error ?? res.message ?? null);
      if (!res.error) router.refresh();
    });

  if (distributors.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">총판별 지급률</h2>
      <p className="text-xs text-muted">
        총판을 선택해, 플랜/상품별 지급률(판매액 대비 %)을 설정합니다. 0%면 수당 없음. 이 비율로 만든
        수당 풀을 총판이 배분비율대로 조직에 나눠줍니다. (예: 119,000 × 40% = 47,600 풀)
      </p>
      {note && <p className="text-sm text-primary">{note}</p>}

      <Card className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted">총판 선택</label>
          <Select
            value={distId}
            onChange={(e) => setDistId(e.target.value)}
            className="w-56"
          >
            {distributors.map((d) => (
              <option key={d.userId} value={d.userId}>
                {d.name} ({d.email})
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="divide-y divide-border p-0">
        {targets.map((t) => (
          <div
            key={`${t.itemType}:${t.itemKey}`}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="min-w-[140px]">
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted">
                {t.itemType === "subscription_plan" ? "구독 플랜" : "상품"}
                {t.price != null ? ` · ${won(t.price)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={valOf(t)}
                  onChange={(e) => setVal(t, e.target.value)}
                  className="w-24 text-right"
                />
                <span className="text-xs text-muted">%</span>
              </label>
              <Button size="sm" onClick={() => save(t)} disabled={busy || !distId}>
                저장
              </Button>
            </div>
          </div>
        ))}
        {targets.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">
            설정할 플랜/상품이 없습니다.
          </p>
        )}
      </Card>
    </section>
  );
}

// ---------------- 네트워크 추천 가입자 ----------------

export function AdminNetworkReferrals({
  referrals,
}: {
  referrals: NetworkReferralItem[];
}) {
  const [q, setQ] = useState("");
  const [onlyPaying, setOnlyPaying] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return referrals.filter((r) => {
      if (onlyPaying && !r.paying) return false;
      if (!term) return true;
      return (
        r.clientName.toLowerCase().includes(term) ||
        r.clientEmail.toLowerCase().includes(term) ||
        r.sellerName.toLowerCase().includes(term) ||
        r.sellerEmail.toLowerCase().includes(term)
      );
    });
  }, [referrals, q, onlyPaying]);

  const payingCount = referrals.filter((r) => r.paying).length;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          네트워크 추천 가입자
        </h2>
        <p className="text-sm text-muted">
          총{" "}
          <b className="tnum text-foreground">
            {referrals.length.toLocaleString()}
          </b>
          명
          <span className="ml-1 text-xs">
            (유료 전환 {payingCount.toLocaleString()}명)
          </span>
        </p>
      </div>
      <p className="text-xs text-muted">
        총판·영업점·리셀러 추천 링크로 가입한 사람들입니다. 일반 사용자 추천은 제외됩니다.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="가입자 / 추천인 검색"
          className="max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={onlyPaying}
            onChange={(e) => setOnlyPaying(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          유료 전환만
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          {referrals.length === 0
            ? "네트워크 추천 가입자가 없습니다."
            : "검색 결과가 없습니다."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="p-3 whitespace-nowrap">가입일</th>
                <th className="p-3">가입자</th>
                <th className="p-3">추천인</th>
                <th className="p-3">역할</th>
                <th className="p-3">플랜</th>
                <th className="p-3">전환</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.clientUserId}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="p-3 whitespace-nowrap text-muted">
                    {fmtDate(r.signupAt)}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{r.clientName}</p>
                    <p className="text-xs text-muted">{r.clientEmail || "-"}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{r.sellerName}</p>
                    <p className="text-xs text-muted">{r.sellerEmail || "-"}</p>
                  </td>
                  <td className="p-3">
                    <Badge tone="default">
                      {ROLE_LABEL[r.sellerRole] ?? r.sellerRole}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge tone={r.plan && r.plan !== "free" ? "success" : "muted"}>
                      {r.plan}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {r.paying ? (
                      <Badge tone="success">유료</Badge>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------- 정산 ----------------

export function AdminSettlements({
  settlements,
}: {
  settlements: SettlementItem[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const [note, setNote] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      setNote(null);
      const res = await fn();
      setNote(res.error ?? res.message ?? null);
      if (!res.error) router.refresh();
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">네트워크 정산</h2>
      <p className="text-xs text-muted">
        월을 선택해 정산을 생성하면 해당 월의 미정산 수당이 멤버별로 마감됩니다. 프리랜서는 3.3%
        원천징수 후 순액이 계산됩니다. 실지급 후 “지급완료”로 표시하세요.
      </p>
      {note && <p className="text-sm text-primary">{note}</p>}

      <Card className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted">정산 월</label>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-44"
          />
        </div>
        <Button
          onClick={() => run(() => generateSettlementsAction(period))}
          disabled={busy}
        >
          {busy ? <Spinner className="size-4" /> : "정산 생성/마감"}
        </Button>
      </Card>

      {settlements.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="p-3">정산월</th>
                <th className="p-3">멤버</th>
                <th className="p-3">유형</th>
                <th className="p-3 text-right">건수</th>
                <th className="p-3 text-right">수당합계</th>
                <th className="p-3 text-right">원천징수</th>
                <th className="p-3 text-right">실지급</th>
                <th className="p-3">상태</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 whitespace-nowrap">{s.period}</td>
                  <td className="p-3">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted">{s.email}</p>
                  </td>
                  <td className="p-3 text-xs">
                    {s.payoutType === "freelancer" ? "프리랜서" : "사업자"}
                  </td>
                  <td className="tnum p-3 text-right">{s.count}</td>
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
                  <td className="p-3">
                    {s.status !== "paid" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `${s.name} · ${s.period} 정산을 지급완료로 표시할까요? (실지급: ${won(s.net)})`,
                            )
                          )
                            run(() => markSettlementPaidAction(s.id));
                        }}
                      >
                        지급완료
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
