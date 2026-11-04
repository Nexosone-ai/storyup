"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SHARE_PLATFORM_LABELS, type SharePlatform } from "@/lib/channelAds/config";
import { setChannelStatusAction } from "@/app/dashboard/admin/channel-ads/actions";

const won = (n: number) => `₩${n.toLocaleString()}`;

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

const STATUS_LABEL: Record<string, string> = {
  pending: "승인 대기",
  active: "공개 중",
  rejected: "반려",
  hidden: "숨김",
};

export function AdminChannelAdsView({ channels }: { channels: AdminChannel[] }) {
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
    </div>
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
