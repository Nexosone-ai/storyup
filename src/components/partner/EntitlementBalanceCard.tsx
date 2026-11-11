import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  ENTITLEMENT_SERVICES,
  type EntitlementBalances,
} from "@/lib/partner/entitlementCatalog";

/**
 * 파트너 보유 작업권 카드(서버 렌더 가능) — 패킷 잔액 카드를 대체(2026-11-11).
 * 작업권은 고객이 파트너 상품을 결제하면 상품에 포함된 만큼 자동으로 생긴다.
 */
export function EntitlementBalanceCard({
  balances,
  ko = true,
  className,
}: {
  balances: EntitlementBalances;
  ko?: boolean;
  className?: string;
}) {
  const total = ENTITLEMENT_SERVICES.reduce((s, x) => s + (balances[x.key] ?? 0), 0);
  return (
    <Card className={`px-4 py-3 ${className ?? ""}`}>
      <p className="text-xs text-muted">{ko ? "보유 작업권" : "Service credits"}</p>
      {total <= 0 ? (
        <p className="mt-1 text-sm text-danger">
          {ko
            ? "고객에게 상품을 판매(결제)하면 작업권이 생겨요"
            : "Sell a product to a client to earn credits"}
        </p>
      ) : (
        <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
          {ENTITLEMENT_SERVICES.map((s) => (
            <li
              key={s.key}
              className={`flex items-baseline justify-between gap-2 ${
                (balances[s.key] ?? 0) > 0 ? "" : "text-muted"
              }`}
            >
              <span className="truncate">{s.shortLabel}</span>
              <span className="shrink-0 tabular-nums">
                <b>{balances[s.key] ?? 0}</b>
                {s.unitLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/partner/sales"
        className="mt-1.5 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        {ko ? "상품 · 판매 →" : "Products & sales →"}
      </Link>
    </Card>
  );
}
