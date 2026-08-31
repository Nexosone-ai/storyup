"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  refundPaymentAction,
  lookupUserPointsAction,
  savePackageAction,
  saveServicePriceAction,
  type UserPointLookup,
} from "@/app/dashboard/admin/actions";

const PAY_STATUS: Record<
  string,
  { label: string; tone: "success" | "muted" | "warning" | "danger" }
> = {
  PENDING: { label: "진행 중", tone: "warning" },
  PAID: { label: "결제 완료", tone: "success" },
  FAILED: { label: "실패", tone: "muted" },
  CANCELLED: { label: "취소됨", tone: "danger" },
  PARTIALLY_CANCELLED: { label: "부분 취소", tone: "danger" },
  REFUNDED: { label: "환불됨", tone: "danger" },
};

export interface AdminPaymentItem {
  id: string;
  created_at: string;
  userName: string;
  userEmail: string;
  orderId: string;
  provider: string;
  method: string;
  amount: number;
  credits: number;
  status: string;
  transactionId: string;
}

export interface AdminPackageItem {
  id: string;
  name: string;
  price_krw: number;
  credits: number;
  bonus_credits: number;
  active: boolean;
  sort_order: number;
}

export interface AdminServicePriceItem {
  service: string;
  label: string;
  price: number;
  active: boolean;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------- 결제 내역 ----------------

export function AdminPayments({ payments }: { payments: AdminPaymentItem[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      payments.filter(
        (p) =>
          (status === "ALL" || p.status === status) &&
          (!q.trim() ||
            p.userEmail.includes(q.trim()) ||
            p.userName.includes(q.trim()) ||
            p.orderId.includes(q.trim())),
      ),
    [payments, status, q],
  );

  const refund = (id: string) => {
    const reason = window.prompt("환불 사유를 입력하세요 (감사 기록에 남습니다)");
    if (reason === null) return;
    start(async () => {
      setNote(null);
      const res = await refundPaymentAction(id, reason);
      setNote(res.error ?? res.message ?? null);
      if (!res.error) router.refresh();
    });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">결제 내역</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-40"
        >
          <option value="ALL">전체 상태</option>
          {Object.entries(PAY_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이메일 / 이름 / 주문 ID 검색"
          className="max-w-xs"
        />
      </div>
      {note && <p className="text-sm text-primary">{note}</p>}
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          결제 내역이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="p-3">일시</th>
                <th className="p-3">사용자</th>
                <th className="p-3">주문/거래 ID</th>
                <th className="p-3">수단</th>
                <th className="p-3 text-right">금액</th>
                <th className="p-3 text-right">크레딧</th>
                <th className="p-3">상태</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 whitespace-nowrap">{fmtDateTime(p.created_at)}</td>
                  <td className="p-3">
                    <p className="font-medium">{p.userName}</p>
                    <p className="text-xs text-muted">{p.userEmail}</p>
                  </td>
                  <td className="p-3">
                    <p className="max-w-40 truncate font-mono text-xs">{p.orderId}</p>
                    {p.transactionId && (
                      <p className="max-w-40 truncate font-mono text-xs text-muted">
                        {p.transactionId}
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {p.provider}/{p.method || "-"}
                  </td>
                  <td className="tnum p-3 text-right">
                    ₩{p.amount.toLocaleString()}
                  </td>
                  <td className="tnum p-3 text-right">
                    {p.credits.toLocaleString()} P
                  </td>
                  <td className="p-3">
                    <Badge tone={PAY_STATUS[p.status]?.tone ?? "muted"}>
                      {PAY_STATUS[p.status]?.label ?? p.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {p.status === "PAID" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refund(p.id)}
                        disabled={busy}
                      >
                        환불
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

// ---------------- 사용자 포인트 조회 ----------------

export function AdminPointLookup() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<UserPointLookup | null>(null);
  const [busy, start] = useTransition();

  const lookup = () =>
    start(async () => {
      setResult(await lookupUserPointsAction(email));
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">사용자 포인트 조회</h2>
      <Card className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <Button size="sm" onClick={lookup} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : "조회"}
          </Button>
        </div>
        {result?.error && <p className="text-sm text-danger">{result.error}</p>}
        {result && !result.error && (
          <div className="space-y-3">
            <p className="text-sm">
              <b>{result.name}</b>{" "}
              <span className="text-muted">{result.email}</span>
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface-muted p-3">
                <p className="text-xs text-muted">잔액</p>
                <p className="tnum font-bold">{result.balance?.toLocaleString()} P</p>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <p className="text-xs text-muted">충전 크레딧 잔여</p>
                <p className="tnum font-bold">
                  {result.purchasedRemaining?.toLocaleString()} P
                </p>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <p className="text-xs text-muted">출금 가능(수익)</p>
                <p className="tnum font-bold">
                  {result.withdrawable?.toLocaleString()} P
                </p>
              </div>
            </div>
            {result.recent && result.recent.length > 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {result.recent.map((t, i) => (
                  <li key={i} className="flex justify-between p-2.5 text-sm">
                    <span className="truncate">{t.reason}</span>
                    <span
                      className={`tnum ml-3 shrink-0 ${t.amount >= 0 ? "text-primary" : "text-danger"}`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {t.amount.toLocaleString()} P
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}

// ---------------- 패키지 관리 ----------------

function PackageEditor({
  initial,
  onSaved,
}: {
  initial?: AdminPackageItem;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(String(initial?.price_krw ?? ""));
  const [credits, setCredits] = useState(String(initial?.credits ?? ""));
  const [bonus, setBonus] = useState(String(initial?.bonus_credits ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [sort, setSort] = useState(String(initial?.sort_order ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      const res = await savePackageAction({
        id: initial?.id,
        name,
        price_krw: Number(price),
        credits: Number(credits),
        bonus_credits: Number(bonus),
        active,
        sort_order: Number(sort) || 0,
      });
      if (res.error) setError(res.error);
      else onSaved();
    });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <div>
          <Label>이름</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>금액(₩)</Label>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <Label>크레딧</Label>
          <Input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} />
        </div>
        <div>
          <Label>보너스</Label>
          <Input type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </div>
        <div>
          <Label>순서</Label>
          <Input type="number" value={sort} onChange={(e) => setSort(e.target.value)} />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            판매
          </label>
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : "저장"}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function AdminPackages({ packages }: { packages: AdminPackageItem[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">충전 패키지 관리</h2>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          {adding ? "닫기" : "+ 패키지 추가"}
        </Button>
      </div>
      <Card className="space-y-5">
        {adding && (
          <PackageEditor
            onSaved={() => {
              setAdding(false);
              router.refresh();
            }}
          />
        )}
        {packages.map((p) => (
          <PackageEditor key={p.id} initial={p} onSaved={() => router.refresh()} />
        ))}
      </Card>
    </section>
  );
}

// ---------------- 서비스 가격 관리 ----------------

export function AdminServicePrices({
  prices,
}: {
  prices: AdminServicePriceItem[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);

  const save = (item: AdminServicePriceItem, active: boolean) =>
    start(async () => {
      setNote(null);
      const price = Number(edits[item.service] ?? item.price);
      const res = await saveServicePriceAction(item.service, price, active);
      setNote(res.error ?? res.message ?? null);
      if (!res.error) router.refresh();
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">AI 서비스 가격</h2>
      <p className="text-xs text-muted">
        0P = 무료. 가격을 설정하면 해당 서비스 사용 시 크레딧이 차감됩니다.
      </p>
      {note && <p className="text-sm text-primary">{note}</p>}
      <Card className="divide-y divide-border p-0">
        {prices.map((s) => (
          <div
            key={s.service}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div>
              <p className="text-sm font-medium">{s.label}</p>
              <p className="font-mono text-xs text-muted">{s.service}</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                defaultValue={s.price}
                onChange={(e) =>
                  setEdits((prev) => ({ ...prev, [s.service]: e.target.value }))
                }
                className="w-28 text-right"
              />
              <span className="text-sm text-muted">P</span>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={s.active}
                  onChange={(e) => save(s, e.target.checked)}
                />
                활성
              </label>
              <Button size="sm" onClick={() => save(s, s.active)} disabled={busy}>
                저장
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}
