"use client";

import {
  useMemo,
  useState,
  useTransition,
  type TransitionStartFunction,
} from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import {
  PUBLISH_CHANNELS,
  PUBLISH_CHANNEL_LABEL,
  type PublishChannel,
} from "@/types/domain";
import { exportForChannel } from "@/utils/publishExport";
import type { PublishingData } from "@/lib/publishing";
import {
  setConnection,
  createSchedule,
  deleteSchedule,
} from "@/app/business/[id]/publishing/actions";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function PublishingHub({
  businessId,
  data,
}: {
  businessId: string;
  data: PublishingData;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow mb-2">발행</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          채널 발행 준비
        </h1>
        <p className="mt-1.5 text-muted">
          채널 연결 상태를 관리하고, 글을 채널별로 내보내거나 예약하세요.
        </p>
      </div>

      <Connections businessId={businessId} data={data} pending={pending} start={start} router={router} />
      <Exporter data={data} />
      <Scheduler businessId={businessId} data={data} pending={pending} start={start} router={router} />
    </div>
  );
}

/* ---------------- Connections ---------------- */
function Connections({
  businessId,
  data,
  pending,
  start,
  router,
}: {
  businessId: string;
  data: PublishingData;
  pending: boolean;
  start: TransitionStartFunction;
  router: ReturnType<typeof useRouter>;
}) {
  const byChannel = useMemo(() => {
    const m = new Map(data.connections.map((c) => [c.channel, c]));
    return m;
  }, [data.connections]);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">채널 연결</h2>
      <div className="grid gap-3">
        {PUBLISH_CHANNELS.map((ch) => (
          <ConnectionRow
            key={ch}
            channel={ch}
            initial={byChannel.get(ch)}
            onSave={(connected, label) =>
              start(async () => {
                await setConnection(businessId, ch, connected, label);
                router.refresh();
              })
            }
            pending={pending}
          />
        ))}
      </div>
    </section>
  );
}

function ConnectionRow({
  channel,
  initial,
  onSave,
  pending,
}: {
  channel: PublishChannel;
  initial?: { connected: boolean; account_label: string | null };
  onSave: (connected: boolean, label: string) => void;
  pending: boolean;
}) {
  const [connected, setConnected] = useState(initial?.connected ?? false);
  const [label, setLabel] = useState(initial?.account_label ?? "");

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`size-2.5 rounded-full ${connected ? "bg-primary" : "bg-border-strong"}`}
        />
        <span className="font-medium">{PUBLISH_CHANNEL_LABEL[channel]}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="계정/블로그 주소 (선택)"
          className="h-9"
        />
        <div className="flex gap-2">
          <Button
            variant={connected ? "outline" : "primary"}
            size="sm"
            onClick={() => {
              setConnected(!connected);
              onSave(!connected, label);
            }}
            disabled={pending}
          >
            {connected ? "연결 해제" : "연결됨으로 표시"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSave(connected, label)}
            disabled={pending}
          >
            저장
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Exporter ---------------- */
function Exporter({ data }: { data: PublishingData }) {
  const [postId, setPostId] = useState(data.posts[0]?.id ?? "");
  const [channel, setChannel] = useState<PublishChannel>("blogger");
  const [copied, setCopied] = useState(false);

  const post = data.posts.find((p) => p.id === postId);
  const out = post ? exportForChannel(post, channel) : null;

  const copy = async () => {
    if (!out) return;
    await navigator.clipboard.writeText(out.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    if (!out) return;
    const blob = new Blob([out.text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = out.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (data.posts.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">채널별 내보내기</h2>
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          먼저 블로그 글을 작성하면 채널별로 내보낼 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">채널별 내보내기</h2>
      <Card className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="exp-post">블로그 글</Label>
            <Select id="exp-post" value={postId} onChange={(e) => setPostId(e.target.value)}>
              {data.posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="exp-ch">채널</Label>
            <Select
              id="exp-ch"
              value={channel}
              onChange={(e) => setChannel(e.target.value as PublishChannel)}
            >
              {PUBLISH_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {PUBLISH_CHANNEL_LABEL[c]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <textarea
          readOnly
          value={out?.text ?? ""}
          className="min-h-64 w-full rounded-lg border border-border bg-surface-muted/40 p-4 font-mono text-xs leading-relaxed"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={copy}>
            {copied ? <Icon.check className="size-4" /> : <Icon.copy className="size-4" />}
            {copied ? "복사됨" : "복사"}
          </Button>
          <Button size="sm" variant="outline" onClick={download}>
            <Icon.external className="size-4" />
            .md 다운로드
          </Button>
        </div>
      </Card>
    </section>
  );
}

/* ---------------- Scheduler ---------------- */
function Scheduler({
  businessId,
  data,
  pending,
  start,
  router,
}: {
  businessId: string;
  data: PublishingData;
  pending: boolean;
  start: TransitionStartFunction;
  router: ReturnType<typeof useRouter>;
}) {
  const [postId, setPostId] = useState(data.posts[0]?.id ?? "");
  const [channel, setChannel] = useState<PublishChannel>("blogger");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);

  const postTitle = (id: string | null) =>
    data.posts.find((p) => p.id === id)?.title ?? "(삭제된 글)";

  const add = () =>
    start(async () => {
      setError(null);
      const res = await createSchedule(businessId, postId, channel, when);
      if (res.error) setError(res.error);
      else {
        setWhen("");
        router.refresh();
      }
    });

  const remove = (id: string) =>
    start(async () => {
      await deleteSchedule(businessId, id);
      router.refresh();
    });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">발행 예약</h2>
      {data.posts.length > 0 && (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="sc-post">글</Label>
              <Select id="sc-post" value={postId} onChange={(e) => setPostId(e.target.value)}>
                {data.posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="sc-ch">채널</Label>
              <Select id="sc-ch" value={channel} onChange={(e) => setChannel(e.target.value as PublishChannel)}>
                {PUBLISH_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {PUBLISH_CHANNEL_LABEL[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="sc-when">예약 시간</Label>
              <Input
                id="sc-when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="sm" onClick={add} disabled={pending}>
            {pending ? <Spinner className="size-4" /> : "예약 추가"}
          </Button>
        </Card>
      )}

      {data.schedules.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {data.schedules.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {postTitle(s.blog_post_id)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {PUBLISH_CHANNEL_LABEL[s.channel as PublishChannel]} ·{" "}
                  {fmt(s.scheduled_at)}
                </p>
              </div>
              <button
                onClick={() => remove(s.id)}
                disabled={pending}
                className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-danger"
                aria-label="예약 삭제"
              >
                <Icon.x width={16} height={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
