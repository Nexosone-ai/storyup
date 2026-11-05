"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SHARE_PLATFORM_LABELS, type SharePlatform } from "@/lib/channelAds/config";
import {
  setChannelStatusAction,
  setShareEarningPaidAction,
  setShareOrderAdminStatusAction,
} from "@/app/dashboard/admin/channel-ads/actions";

const won = (n: number) => `₩${n.toLocaleString()}`;
const platLabel = (p: string) =>
  SHARE_PLATFORM_LABELS[p as SharePlatform] ?? p;

export interface AdminChannel {
  id: string;
  ownerLabel: string;
  platform: string;
  handle: string | null;
  url: string | null;
  followerCount: number;
  priceKrw: number;
  description: string | null;
  status: string;
  createdAt: string;
}

export interface AdminOrder {
  id: string;
  advertiserLabel: string;
  ownerLabel: string;
  platform: string;
  priceKrw: number;
  contentType: string;
  contentUrl: string;
  contentTitle: string | null;
  status: string;
  proofUrl: string | null;
  createdAt: string;
  earningStatus: string | null;
  netKrw: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "승인 대기",
  active: "공개 중",
  rejected: "반려",
  hidden: "숨김",
};
const ORDER_STATUS_LABEL: Record<string, string> = {
  paid: "게시 대기",
  shared: "증빙 제출됨",
  confirmed: "확인 완료",
  settled: "정산 확정",
  refunded: "환불됨",
  disputed: "분쟁",
  cancelled: "취소됨",
};
const EARN_STATUS_LABEL: Record<string, string> = {
  held: "확정 전",
  pending: "지급 대기",
  paid: "지급 완료",
};

export function AdminChannelAdsView({
  channels,
  orders,
}: {
  channels: AdminChannel[];
  orders: AdminOrder[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">채널 광고 — 채널 승인</h2>
        <p className="mt-1 text-sm text-muted">
          채널 보유자가 등록한 SNS 채널을 검토해 공개/반려합니다.
        </p>
      </div>
      {channels.length === 0 ? (
        <Card className="p-8">
          <p className="text-sm text-muted">등록된 채널이 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {channels.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {SHARE_PLATFORM_LABELS[c.platform as SharePlatform] ?? c.platform}
                    {c.handle && (
                      <span className="ml-1.5 text-sm text-muted">{c.handle}</span>
                    )}
                    <span className="ml-2 text-xs text-muted">· {c.ownerLabel}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    단가 {won(c.priceKrw)} · 팔로워 {c.followerCount.toLocaleString()} ·{" "}
                    {STATUS_LABEL[c.status] ?? c.status}
                  </p>
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block truncate text-xs text-primary hover:underline"
                    >
                      {c.url}
                    </a>
                  )}
                  {c.description && (
                    <p className="mt-1 whitespace-pre-line text-xs text-muted">
                      {c.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusButton id={c.id} status="active" label="승인(공개)" disabledWhen={c.status === "active"} />
                <StatusButton id={c.id} status="rejected" label="반려" disabledWhen={c.status === "rejected"} />
                <StatusButton id={c.id} status="hidden" label="숨김" disabledWhen={c.status === "hidden"} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── 공유 의뢰·정산 ── */}
      <div className="pt-4">
        <h2 className="text-lg font-semibold">공유 의뢰 · 정산</h2>
        <p className="mt-1 text-sm text-muted">
          결제·게시·확정 현황과 정산을 관리합니다. 지급 완료·환불은 실제 송금/환불을
          수동 처리한 뒤 상태만 반영하세요(기록은 삭제되지 않습니다).
        </p>
      </div>
      {orders.length === 0 ? (
        <Card className="p-8">
          <p className="text-sm text-muted">아직 결제된 의뢰가 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {platLabel(o.platform)} · {won(o.priceKrw)}
                    <span className="ml-2 text-xs font-normal text-muted">
                      광고주 {o.advertiserLabel} → 채널 {o.ownerLabel}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    [{o.contentType === "blog" ? "블로그" : "카드뉴스"}]{" "}
                    {o.contentTitle ?? ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span>
                      주문: {ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    {o.earningStatus && (
                      <span>
                        정산: {EARN_STATUS_LABEL[o.earningStatus] ?? o.earningStatus}
                        {o.netKrw != null ? ` (${won(o.netKrw)})` : ""}
                      </span>
                    )}
                  </div>
                  {o.proofUrl && (
                    <a
                      href={o.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block truncate text-xs text-primary hover:underline"
                    >
                      증빙: {o.proofUrl}
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <EarningPaidButton
                  shareOrderId={o.id}
                  disabledWhen={o.earningStatus !== "pending"}
                />
                <OrderStatusButton
                  shareOrderId={o.id}
                  status="refunded"
                  label="환불 처리"
                  disabledWhen={o.status === "refunded" || o.earningStatus === "paid"}
                />
                <OrderStatusButton
                  shareOrderId={o.id}
                  status="disputed"
                  label="분쟁 표시"
                  disabledWhen={o.status === "disputed"}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EarningPaidButton({
  shareOrderId,
  disabledWhen,
}: {
  shareOrderId: string;
  disabledWhen: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={busy || disabledWhen}
      onClick={() =>
        start(async () => {
          await setShareEarningPaidAction(shareOrderId);
          router.refresh();
        })
      }
    >
      지급 완료 표시
    </Button>
  );
}

function OrderStatusButton({
  shareOrderId,
  status,
  label,
  disabledWhen,
}: {
  shareOrderId: string;
  status: "refunded" | "disputed";
  label: string;
  disabledWhen: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy || disabledWhen}
      onClick={() =>
        start(async () => {
          await setShareOrderAdminStatusAction(shareOrderId, status);
          router.refresh();
        })
      }
    >
      {label}
    </Button>
  );
}

function StatusButton({
  id,
  status,
  label,
  disabledWhen,
}: {
  id: string;
  status: "active" | "rejected" | "hidden" | "pending";
  label: string;
  disabledWhen: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <Button
      size="sm"
      variant={status === "active" ? "primary" : "outline"}
      disabled={busy || disabledWhen}
      onClick={() =>
        start(async () => {
          await setChannelStatusAction(id, status);
          router.refresh();
        })
      }
    >
      {label}
    </Button>
  );
}
