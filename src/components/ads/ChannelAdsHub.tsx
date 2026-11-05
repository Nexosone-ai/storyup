"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select, Label } from "@/components/ui/Field";
import {
  SHARE_PLATFORMS,
  SHARE_PLATFORM_LABELS,
  type SharePlatform,
} from "@/lib/channelAds/config";
import {
  saveChannelAction,
  setChannelHiddenAction,
} from "@/app/dashboard/ads/channel-actions";

const won = (n: number) => `₩${n.toLocaleString()}`;

export interface MyChannel {
  id: string;
  platform: string;
  handle: string | null;
  url: string | null;
  followerCount: number;
  priceKrw: number;
  description: string | null;
  status: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "승인 대기", cls: "bg-surface-2 text-muted" },
  active: { label: "공개 중", cls: "bg-success/15 text-success" },
  rejected: { label: "반려", cls: "bg-danger/10 text-danger" },
  hidden: { label: "숨김", cls: "bg-surface-2 text-muted" },
};

type Tab = "channels" | "request" | "jobs" | "earnings";

export function ChannelAdsHub({ myChannels }: { myChannels: MyChannel[] }) {
  const [tab, setTab] = useState<Tab>("channels");
  const TABS: { id: Tab; label: string }[] = [
    { id: "channels", label: "내 채널" },
    { id: "request", label: "광고 의뢰하기" },
    { id: "jobs", label: "받은 의뢰" },
    { id: "earnings", label: "수익" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">광고 수익</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          채널 공유 마켓플레이스
        </h1>
        <p className="mt-1.5 text-muted">
          내 SNS 채널(유튜브·페북·인스타·틱톡·카카오·밴드 등)을 등록하고 공유 단가를
          정하면, 광고주가 블로그·카드뉴스 공유를 의뢰합니다. 입금 확인 후 직접 게시하고
          증빙을 올리면 수수료 20%를 제외한 금액이 정산됩니다.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "channels" && <ChannelsTab channels={myChannels} />}
      {tab === "request" && <ComingSoonTab text="광고 의뢰하기 기능을 준비 중입니다." />}
      {tab === "jobs" && <ComingSoonTab text="받은 공유 의뢰가 여기에 표시됩니다." />}
      {tab === "earnings" && <ComingSoonTab text="정산 내역이 여기에 표시됩니다." />}
    </div>
  );
}

function ComingSoonTab({ text }: { text: string }) {
  return (
    <Card className="p-8">
      <p className="text-sm text-muted">{text}</p>
    </Card>
  );
}

function ChannelsTab({ channels }: { channels: MyChannel[] }) {
  const [editing, setEditing] = useState<MyChannel | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      {!creating && !editing && (
        <Button onClick={() => setCreating(true)}>+ 채널 등록</Button>
      )}
      {(creating || editing) && (
        <ChannelForm
          channel={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      <div className="space-y-3">
        {channels.length === 0 && !creating && (
          <p className="text-sm text-muted">아직 등록한 채널이 없습니다.</p>
        )}
        {channels.map((c) => {
          const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.pending;
          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {SHARE_PLATFORM_LABELS[c.platform as SharePlatform] ?? c.platform}
                    {c.handle && (
                      <span className="ml-1.5 text-sm text-muted">{c.handle}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    단가 {won(c.priceKrw)} · 팔로워 {c.followerCount.toLocaleString()}
                  </p>
                  {c.url && (
                    <p className="mt-0.5 truncate text-xs text-muted">{c.url}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(c)}>
                  편집
                </Button>
                {(c.status === "active" || c.status === "hidden") && (
                  <HiddenToggle id={c.id} status={c.status} />
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function HiddenToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const hide = status === "active";
  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={() =>
        start(async () => {
          await setChannelHiddenAction(id, hide);
          router.refresh();
        })
      }
    >
      {hide ? "숨기기" : "공개하기"}
    </Button>
  );
}

function ChannelForm({
  channel,
  onDone,
}: {
  channel: MyChannel | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState(channel?.platform ?? "youtube");
  const [handle, setHandle] = useState(channel?.handle ?? "");
  const [url, setUrl] = useState(channel?.url ?? "");
  const [followers, setFollowers] = useState(
    channel ? String(channel.followerCount) : "",
  );
  const [price, setPrice] = useState(channel ? String(channel.priceKrw) : "");
  const [description, setDescription] = useState(channel?.description ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await saveChannelAction({
        id: channel?.id,
        platform: platform as SharePlatform,
        handle: handle || null,
        url: url || null,
        followerCount: Number(followers) || 0,
        priceKrw: Number(price) || 0,
        description: description || null,
      });
      if (res.error) setMsg(res.error);
      else {
        onDone();
        router.refresh();
      }
    });

  return (
    <Card className="space-y-4 p-6">
      <h3 className="font-semibold">{channel ? "채널 편집" : "채널 등록"}</h3>
      <p className="text-xs text-muted">
        등록·수정 시 관리자 승인을 거친 뒤 광고주에게 공개됩니다.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label required>플랫폼</Label>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {SHARE_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {SHARE_PLATFORM_LABELS[p]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label required>1회 공유 단가(원)</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>채널명/핸들</Label>
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@mychannel"
          />
        </div>
        <div>
          <Label>팔로워 수</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label>채널 URL</Label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
        />
      </div>
      <div>
        <Label>소개 · 공유 조건</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 20대 여성 팔로워 중심, 피드 1회 게시 + 24시간 유지"
        />
      </div>
      {msg && <p className="text-sm text-danger">{msg}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? "저장 중…" : "저장"}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          취소
        </Button>
      </div>
    </Card>
  );
}
