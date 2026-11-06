"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PortOne from "@portone/browser-sdk/v2";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import {
  cancelMyPacketOrderAction,
  createPacketCardOrderAction,
  createPacketTransferOrderAction,
} from "@/app/partner/packets/actions";
import type { PacketOrderRow } from "@/lib/partner/packets";

/* 서버 상수와 동일(표시·클라이언트 검증용). 확정 금액은 항상 서버가 계산한다. */
const UNIT = 100;
const VAT_RATE = 0.1;
const MIN = 100;
const STEP = 100;
const MAX = 100_000;
const PRESETS = [100, 500, 1000, 3000] as const;

const won = (n: number) => `${n.toLocaleString()}원`;
const field =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary";

type Method = "card" | "transfer";

export interface PacketStoreProps {
  balance: number;
  orders: PacketOrderRow[];
  buyer: { name: string; email: string };
  bank: { bank: string; number: string; holder: string };
  cardEnabled: boolean;
}

function quote(packets: number) {
  const supply = packets * UNIT;
  const vat = Math.round(supply * VAT_RATE);
  return { supply, vat, total: supply + vat };
}

function validate(n: number): string | null {
  if (!Number.isInteger(n)) return "패킷 수량을 정수로 입력해주세요.";
  if (n < MIN)
    return `최소 ${MIN.toLocaleString()}패킷부터 구매할 수 있습니다.`;
  if (n % STEP !== 0) return `${STEP}패킷 단위로 입력해주세요.`;
  if (n > MAX)
    return `한 번에 최대 ${MAX.toLocaleString()}패킷까지 구매할 수 있습니다.`;
  return null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "입금 대기",
  paid: "지급 완료",
  cancelled: "취소",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function PacketStore({
  balance,
  orders,
  buyer,
  bank,
  cardEnabled,
}: PacketStoreProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [packets, setPackets] = useState<number>(500);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState<Method>(
    cardEnabled ? "card" : "transfer",
  );
  const [name, setName] = useState(buyer.name);
  const [email, setEmail] = useState(buyer.email);
  const [phone, setPhone] = useState("");
  const [depositor, setDepositor] = useState(buyer.name);
  const [note, setNote] = useState<string | null>(null);
  const [issued, setIssued] = useState<PacketOrderRow | null>(null);

  const invalid = validate(packets);
  const q = useMemo(() => quote(invalid ? 0 : packets), [packets, invalid]);

  const pickPreset = (n: number) => {
    setPackets(n);
    setCustom("");
  };
  const onCustom = (v: string) => {
    setCustom(v);
    const n = Number(v.replace(/[^0-9]/g, ""));
    if (v.trim()) setPackets(n);
  };

  const buyCard = () =>
    startTransition(async () => {
      setNote(null);
      const res = await createPacketCardOrderAction({
        packets,
        buyer: { name, email, phone },
      });
      if (res.error || !res.order) {
        setNote(res.error ?? "주문을 시작하지 못했습니다.");
        return;
      }
      const order = res.order;
      try {
        const pay = await PortOne.requestPayment({
          storeId: order.storeId,
          channelKey: order.channelKey,
          paymentId: order.orderId,
          orderName: order.orderName,
          totalAmount: order.amount,
          currency: "KRW",
          payMethod: "CARD",
          redirectUrl: `${window.location.origin}/partner/packets/result`,
          customer: {
            fullName: name.trim(),
            phoneNumber: phone.replace(/[^0-9]/g, ""),
            email: email.trim(),
          },
        });
        if (pay?.code) {
          setNote(pay.message ?? "결제가 완료되지 않았습니다.");
          return;
        }
        router.push(
          `/partner/packets/result?paymentId=${encodeURIComponent(order.orderId)}`,
        );
      } catch {
        setNote("결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    });

  const issueInvoice = () =>
    startTransition(async () => {
      setNote(null);
      const res = await createPacketTransferOrderAction({
        packets,
        depositorName: depositor,
        buyer: { name, email, phone },
      });
      if (res.error || !res.order) {
        setNote(res.error ?? "청구서를 발행하지 못했습니다.");
        return;
      }
      setIssued(res.order);
      router.refresh();
    });

  const cancel = (id: string) =>
    startTransition(async () => {
      setNote(null);
      const res = await cancelMyPacketOrderAction(id);
      if (res.error) setNote(res.error);
      else {
        if (issued?.id === id) setIssued(null);
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      {/* 발행된 청구서 안내 */}
      {issued && (
        <Card className="border-primary/40 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Icon.check className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">청구서가 발행되었습니다</h2>
              <p className="mt-1 text-sm text-muted">
                아래 계좌로{" "}
                <strong className="text-foreground">
                  {won(issued.total_krw)}
                </strong>
                을 입금해주세요. 입금자명은{" "}
                <strong className="text-foreground">
                  {issued.depositor_name}
                </strong>{" "}
                으로 맞춰주시면 확인이 빠릅니다. 본사가 입금을 확인하면 패킷{" "}
                {issued.packets.toLocaleString()}개가 지급됩니다(영업일 기준 1일
                이내).
              </p>
              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">청구서 번호</dt>
                  <dd className="font-mono">{issued.invoice_no}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">입금 계좌</dt>
                  <dd>
                    {bank.bank} {bank.number}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">예금주</dt>
                  <dd>{bank.holder}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">입금 금액</dt>
                  <dd className="font-semibold">
                    {won(issued.total_krw)}{" "}
                    <span className="text-xs font-normal text-muted">
                      (공급가 {won(issued.supply_krw)} + 부가세{" "}
                      {won(issued.vat_krw)})
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigator.clipboard
                      ?.writeText(`${bank.bank} ${bank.number} ${bank.holder}`)
                      .then(() => setNote("계좌번호를 복사했어요."))
                      .catch(() => undefined)
                  }
                >
                  <Icon.copy className="size-4" /> 계좌 복사
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => cancel(issued.id)}
                  disabled={pending}
                >
                  청구서 취소
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 수량 + 결제 수단 */}
        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold">1. 수량 선택</h2>
          <p className="mt-1 text-sm text-muted">
            1패킷 = {UNIT}원(부가세 별도). 최소 {MIN.toLocaleString()}패킷,{" "}
            {STEP}패킷 단위.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESETS.map((n) => {
              const on = packets === n && !custom;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => pickPreset(n)}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    on
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <div className="text-lg font-semibold tabular-nums">
                    {n.toLocaleString()}
                    <span className="ml-0.5 text-xs font-normal">패킷</span>
                  </div>
                  <div className="text-xs text-muted">
                    {won(quote(n).total)} (VAT 포함)
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <label className="shrink-0 text-sm text-muted">직접 입력</label>
            <input
              inputMode="numeric"
              value={custom}
              onChange={(e) => onCustom(e.target.value)}
              placeholder={`${MIN}단위, 예: 2000`}
              className={`${field} max-w-[200px]`}
            />
            <span className="text-sm text-muted">패킷</span>
          </div>
          {invalid && <p className="mt-1.5 text-xs text-danger">{invalid}</p>}

          <h2 className="mt-6 font-semibold">2. 결제 수단</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => cardEnabled && setMethod("card")}
              disabled={!cardEnabled}
              className={`rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${
                method === "card"
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <div className="text-sm font-semibold">카드결제</div>
              <div className="text-xs text-muted">
                {cardEnabled
                  ? "결제 즉시 패킷이 지급됩니다."
                  : "현재 카드결제를 준비 중입니다."}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMethod("transfer")}
              className={`rounded-xl border p-3 text-left transition-colors ${
                method === "transfer"
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <div className="text-sm font-semibold">계좌이체(청구서)</div>
              <div className="text-xs text-muted">
                청구서 발행 → 입금 → 본사 확인 후 패킷 지급(수동).
              </div>
            </button>
          </div>

          <h2 className="mt-6 font-semibold">3. 구매자 정보</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 · 상호"
              className={field}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              className={field}
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="연락처(선택)"
              className={field}
            />
          </div>
          {method === "transfer" && (
            <div className="mt-2">
              <input
                value={depositor}
                onChange={(e) => setDepositor(e.target.value)}
                placeholder="입금자명(통장에 찍힐 이름)"
                className={field}
              />
              <p className="mt-1 text-xs text-muted">
                입금 계좌: {bank.bank} {bank.number} ({bank.holder}). 청구서
                발행 후에도 다시 안내됩니다.
              </p>
            </div>
          )}

          {note && <p className="mt-3 text-sm text-danger">{note}</p>}
        </Card>

        {/* 요약 */}
        <Card className="h-fit p-5 sm:p-6 lg:sticky lg:top-6">
          <h2 className="font-semibold">결제 금액</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">패킷</dt>
              <dd className="tabular-nums">
                {invalid ? "—" : `${packets.toLocaleString()}개`}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">공급가 ({UNIT}원 × 수량)</dt>
              <dd className="tabular-nums">{won(q.supply)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">부가세 10%</dt>
              <dd className="tabular-nums">{won(q.vat)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>합계</dt>
              <dd className="tabular-nums">{won(q.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">
            구매 후 보유 패킷:{" "}
            {invalid ? "—" : (balance + packets).toLocaleString()} (현재{" "}
            {balance.toLocaleString()})
          </p>
          {method === "card" ? (
            <Button
              className="mt-4 w-full"
              onClick={buyCard}
              disabled={pending || !!invalid || !cardEnabled}
            >
              {pending ? "처리 중…" : `카드로 ${won(q.total)} 결제`}
            </Button>
          ) : (
            <Button
              className="mt-4 w-full"
              onClick={issueInvoice}
              disabled={pending || !!invalid}
            >
              {pending ? "처리 중…" : "청구서 발행(입금 대기)"}
            </Button>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            패킷은 환불·양도되지 않으며, 작업별 차감량은 파트너 홈의 이용 패킷
            안내를 따릅니다. 세금계산서가 필요하면 본사에 사업자 정보를
            알려주세요.
          </p>
        </Card>
      </div>

      {/* 주문 내역 */}
      <Card className="p-5 sm:p-6">
        <h2 className="font-semibold">구매 내역</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">아직 구매 내역이 없습니다.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-1.5 pr-3">일자</th>
                  <th className="py-1.5 pr-3">번호</th>
                  <th className="py-1.5 pr-3">수단</th>
                  <th className="py-1.5 pr-3 text-right">패킷</th>
                  <th className="py-1.5 pr-3 text-right">금액(VAT 포함)</th>
                  <th className="py-1.5 pr-3">상태</th>
                  <th className="py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-3 tabular-nums">
                      {fmtDate(o.created_at)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {o.invoice_no ?? o.order_id?.slice(0, 12) ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {o.method === "card" ? "카드" : "계좌이체"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {o.packets.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {won(o.total_krw)}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          o.status === "paid"
                            ? "border-success/40 text-success"
                            : o.status === "cancelled"
                              ? "border-border text-muted"
                              : "border-primary/40 text-primary"
                        }`}
                      >
                        {o.method === "card" && o.status === "pending"
                          ? "결제 대기"
                          : (STATUS_LABEL[o.status] ?? o.status)}
                      </span>
                      {o.status === "paid" && o.granted_at && (
                        <span className="ml-1 text-xs text-muted">
                          {fmtDate(o.granted_at)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {o.method === "transfer" && o.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIssued(o)}
                          >
                            입금 안내
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancel(o.id)}
                            disabled={pending}
                          >
                            취소
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
