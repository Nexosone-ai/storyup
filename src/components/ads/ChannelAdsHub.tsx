"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PortOne from "@portone/browser-sdk/v2";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select, Label } from "@/components/ui/Field";
import { formatPhone } from "@/utils/phone";
import {
  SHARE_PLATFORMS,
  SHARE_PLATFORM_LABELS,
  type SharePlatform,
} from "@/lib/channelAds/config";
import {
  saveChannelAction,
  setChannelHiddenAction,
  createChannelShareOrderAction,
  submitShareProofAction,
  confirmShareOrderAction,
} from "@/app/dashboard/ads/channel-actions";

const won = (n: number) => `₩${n.toLocaleString()}`;
const platLabel = (p: string) =>
  SHARE_PLATFORM_LABELS[p as SharePlatform] ?? p;

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
export interface DirectoryChannelView {
  id: string;
  platform: string;
  handle: string | null;
  followerCount: number;
  priceKrw: number;
  description: string | null;
}
export interface ContentItem {
  contentType: "blog" | "card_news";
  refId: string;
  title: string;
  businessName: string;
}
export interface JobView {
  id: string;
  platform: string;
  priceKrw: number;
  contentType: string;
  contentUrl: string;
  contentTitle: string | null;
  message: string | null;
  status: string;
  proofUrl: string | null;
  createdAt: string;
}
export interface EarningRowView {
  id: string;
  shareOrderId: string;
  grossKrw: number;
  feeKrw: number;
  netKrw: number;
  status: string;
  platform: string;
  contentTitle: string | null;
  orderStatus: string;
  createdAt: string;
}
export interface EarningsView {
  rows: EarningRowView[];
  paidKrw: number;
  pendingKrw: number;
  heldKrw: number;
}

const CH_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "승인 대기", cls: "bg-surface-2 text-muted" },
  active: { label: "공개 중", cls: "bg-success/15 text-success" },
  rejected: { label: "반려", cls: "bg-danger/10 text-danger" },
  hidden: { label: "숨김", cls: "bg-surface-2 text-muted" },
};
const JOB_STATUS_LABEL: Record<string, string> = {
  pending_payment: "결제 대기",
  paid: "게시 대기",
  shared: "증빙 제출됨",
  confirmed: "확인 완료",
  settled: "정산 완료",
  cancelled: "취소됨",
  refunded: "환불됨",
  disputed: "분쟁",
};
const EARN_STATUS_LABEL: Record<string, string> = {
  held: "확정 전",
  pending: "지급 대기",
  paid: "지급 완료",
};

type Tab = "channels" | "request" | "requests" | "jobs" | "earnings";

export function ChannelAdsHub(props: {
  myChannels: MyChannel[];
  directory: DirectoryChannelView[];
  myContent: ContentItem[];
  ownerJobs: JobView[];
  myRequests: JobView[];
  earnings: EarningsView;
  buyerName: string;
  buyerEmail: string;
}) {
  const [tab, setTab] = useState<Tab>("channels");
  const TABS: { id: Tab; label: string }[] = [
    { id: "channels", label: "내 채널" },
    { id: "request", label: "광고 의뢰하기" },
    { id: "requests", label: "내 의뢰" },
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
          내 SNS 채널을 등록해 공유 수익을 올리거나, 내 블로그·카드뉴스를 다른 채널에
          공유 의뢰하세요. 입금 확인 후 직접 게시하고 증빙을 올리면 수수료 20%를
          제외한 금액이 정산됩니다.
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

      {tab === "channels" && <ChannelsTab channels={props.myChannels} />}
      {tab === "request" && (
        <RequestTab
          directory={props.directory}
          myContent={props.myContent}
          buyerName={props.buyerName}
          buyerEmail={props.buyerEmail}
        />
      )}
      {tab === "requests" && <MyRequestsTab requests={props.myRequests} />}
      {tab === "jobs" && <JobsTab jobs={props.ownerJobs} />}
      {tab === "earnings" && <EarningsTab earnings={props.earnings} />}
    </div>
  );
}

// ---------------- 내 채널 ----------------
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
          const badge = CH_STATUS_BADGE[c.status] ?? CH_STATUS_BADGE.pending;
          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {platLabel(c.platform)}
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
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
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

// ---------------- 광고 의뢰하기 ----------------
function RequestTab({
  directory,
  myContent,
  buyerName,
  buyerEmail,
}: {
  directory: DirectoryChannelView[];
  myContent: ContentItem[];
  buyerName: string;
  buyerEmail: string;
}) {
  const [selected, setSelected] = useState<DirectoryChannelView | null>(null);

  if (directory.length === 0)
    return (
      <Card className="p-8">
        <p className="text-sm text-muted">
          현재 공유 가능한 채널이 없습니다. 잠시 후 다시 확인해 주세요.
        </p>
      </Card>
    );

  if (selected)
    return (
      <RequestForm
        channel={selected}
        myContent={myContent}
        buyerName={buyerName}
        buyerEmail={buyerEmail}
        onCancel={() => setSelected(null)}
      />
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {directory.map((c) => (
        <Card key={c.id} className="flex flex-col p-5">
          <p className="font-semibold">
            {platLabel(c.platform)}
            {c.handle && <span className="ml-1.5 text-sm text-muted">{c.handle}</span>}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            팔로워 {c.followerCount.toLocaleString()}
          </p>
          {c.description && (
            <p className="mt-2 line-clamp-3 text-xs text-muted">{c.description}</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-primary">{won(c.priceKrw)}</span>
            <Button size="sm" onClick={() => setSelected(c)}>
              의뢰하기
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function RequestForm({
  channel,
  myContent,
  buyerName,
  buyerEmail,
  onCancel,
}: {
  channel: DirectoryChannelView;
  myContent: ContentItem[];
  buyerName: string;
  buyerEmail: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [contentKey, setContentKey] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState(buyerName);
  const [email, setEmail] = useState(buyerEmail);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const pay = () =>
    start(async () => {
      setNote(null);
      const picked = myContent.find(
        (c) => `${c.contentType}:${c.refId}` === contentKey,
      );
      if (!picked) {
        setNote("공유할 콘텐츠를 선택해주세요.");
        return;
      }
      const { order, error } = await createChannelShareOrderAction({
        channelId: channel.id,
        contentType: picked.contentType,
        contentRefId: picked.refId,
        message: message || null,
        buyer: { name: name.trim(), email: email.trim(), phone },
      });
      if (error || !order) {
        setNote(error ?? "의뢰를 시작하지 못했습니다.");
        return;
      }
      try {
        const res = await PortOne.requestPayment({
          storeId: order.storeId,
          channelKey: order.channelKey,
          paymentId: order.orderId,
          orderName: order.orderName,
          totalAmount: order.amount,
          currency: "KRW",
          payMethod: "CARD",
          redirectUrl: `${window.location.origin}/dashboard/ads/result`,
          customer: {
            fullName: name.trim(),
            phoneNumber: phone.replace(/[^0-9]/g, ""),
            email: email.trim(),
          },
        });
        if (res?.code) {
          setNote(res.message ?? "결제가 완료되지 않았습니다.");
          return;
        }
        router.push(
          `/dashboard/ads/result?paymentId=${encodeURIComponent(order.orderId)}`,
        );
      } catch {
        setNote("결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    });

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {platLabel(channel.platform)} 공유 의뢰 · {won(channel.priceKrw)}
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          ← 목록
        </Button>
      </div>

      <div>
        <Label required>공유할 내 콘텐츠</Label>
        {myContent.length === 0 ? (
          <p className="mt-1 text-sm text-muted">
            공유할 발행 블로그·카드뉴스가 없습니다. 먼저 글을 발행해 주세요.
          </p>
        ) : (
          <Select value={contentKey} onChange={(e) => setContentKey(e.target.value)}>
            <option value="">선택</option>
            {myContent.map((c) => (
              <option key={`${c.contentType}:${c.refId}`} value={`${c.contentType}:${c.refId}`}>
                [{c.contentType === "blog" ? "블로그" : "카드뉴스"}] {c.title}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div>
        <Label>요청 메시지(선택)</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="예: 금요일 저녁에 게시 부탁드립니다."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label required>이름</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <Label>휴대폰</Label>
          <Input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            maxLength={13}
          />
        </div>
      </div>
      <div>
        <Label required>이메일</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      {note && <p className="text-sm text-danger">{note}</p>}
      <Button className="w-full" onClick={pay} disabled={busy || myContent.length === 0}>
        {busy ? "진행 중…" : `${won(channel.priceKrw)} 결제하고 의뢰`}
      </Button>
      <p className="text-xs text-muted">
        결제 후 채널 보유자가 직접 게시하고 증빙을 제출하면, 확인 후 정산됩니다.
      </p>
    </Card>
  );
}

// ---------------- 받은 의뢰(채널 보유자) ----------------
function JobsTab({ jobs }: { jobs: JobView[] }) {
  if (jobs.length === 0)
    return (
      <Card className="p-8">
        <p className="text-sm text-muted">아직 들어온 공유 의뢰가 없습니다.</p>
      </Card>
    );
  return (
    <div className="space-y-3">
      {jobs.map((j) => (
        <Card key={j.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {platLabel(j.platform)} · {won(j.priceKrw)}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                [{j.contentType === "blog" ? "블로그" : "카드뉴스"}]{" "}
                {j.contentTitle ?? ""}
              </p>
              <a
                href={j.contentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 block truncate text-xs text-primary hover:underline"
              >
                {j.contentUrl}
              </a>
              {j.message && (
                <p className="mt-1 text-xs text-muted">요청: {j.message}</p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
              {JOB_STATUS_LABEL[j.status] ?? j.status}
            </span>
          </div>
          {j.status === "paid" ? (
            <ProofForm jobId={j.id} />
          ) : j.proofUrl ? (
            <p className="mt-2 text-xs text-muted">
              제출한 증빙:{" "}
              <a
                href={j.proofUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {j.proofUrl}
              </a>
            </p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function ProofForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-2/40 p-3">
      <Label>게시 증빙 링크(게시물 URL)</Label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… 게시한 글/영상 주소"
        />
        <Button
          className="shrink-0"
          disabled={busy || !url.trim()}
          onClick={() =>
            start(async () => {
              setMsg(null);
              const res = await submitShareProofAction(jobId, url.trim());
              if (res.error) setMsg(res.error);
              else router.refresh();
            })
          }
        >
          {busy ? "제출 중…" : "증빙 제출"}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        직접 게시한 뒤 해당 게시물 주소를 제출하세요. 광고주 확인(또는 7일 후 자동확정)
        시 정산됩니다.
      </p>
      {msg && <p className="mt-1 text-sm text-danger">{msg}</p>}
    </div>
  );
}

// ---------------- 내 의뢰(광고주) ----------------
function MyRequestsTab({ requests }: { requests: JobView[] }) {
  if (requests.length === 0)
    return (
      <Card className="p-8">
        <p className="text-sm text-muted">
          아직 보낸 공유 의뢰가 없습니다. ‘광고 의뢰하기’에서 시작하세요.
        </p>
      </Card>
    );
  return (
    <div className="space-y-3">
      {requests.map((j) => (
        <Card key={j.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {platLabel(j.platform)} · {won(j.priceKrw)}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                [{j.contentType === "blog" ? "블로그" : "카드뉴스"}]{" "}
                {j.contentTitle ?? ""}
              </p>
              {j.proofUrl && (
                <a
                  href={j.proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block truncate text-xs text-primary hover:underline"
                >
                  게시 증빙: {j.proofUrl}
                </a>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
              {JOB_STATUS_LABEL[j.status] ?? j.status}
            </span>
          </div>
          {j.status === "shared" && <ConfirmButton jobId={j.id} />}
        </Card>
      ))}
    </div>
  );
}

function ConfirmButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <div className="mt-3">
      <Button
        disabled={busy}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const res = await confirmShareOrderAction(jobId);
            if (res.error) setMsg(res.error);
            else router.refresh();
          })
        }
      >
        {busy ? "처리 중…" : "게시 확인 · 정산 승인"}
      </Button>
      <p className="mt-1.5 text-xs text-muted">
        게시물을 확인했다면 승인해 주세요. 7일 내 미확인 시 자동으로 확정됩니다.
      </p>
      {msg && <p className="mt-1 text-sm text-danger">{msg}</p>}
    </div>
  );
}

// ---------------- 수익(채널 보유자) ----------------
function EarningsTab({ earnings }: { earnings: EarningsView }) {
  const { rows, paidKrw, pendingKrw, heldKrw } = earnings;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted">지급 완료</p>
          <p className="mt-1 text-lg font-semibold text-success">{won(paidKrw)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">지급 대기</p>
          <p className="mt-1 text-lg font-semibold text-primary">{won(pendingKrw)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">확정 전</p>
          <p className="mt-1 text-lg font-semibold text-muted">{won(heldKrw)}</p>
        </Card>
      </div>
      {rows.length === 0 ? (
        <Card className="p-8">
          <p className="text-sm text-muted">아직 정산 내역이 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => (
            <Card key={e.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {platLabel(e.platform)} · {e.contentTitle ?? ""}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  결제 {won(e.grossKrw)} · 수수료 {won(e.feeKrw)} · 정산{" "}
                  <span className="font-semibold text-foreground">{won(e.netKrw)}</span>
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
                {EARN_STATUS_LABEL[e.status] ?? e.status}
              </span>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">
        정산 금액은 수수료 20%를 제외한 금액입니다. 실제 지급은 담당자가 확인 후
        처리합니다.
      </p>
    </div>
  );
}
