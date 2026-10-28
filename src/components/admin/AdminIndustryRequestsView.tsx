"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  reviewIndustryRequestAction,
  adoptRequestAction,
} from "@/app/dashboard/admin/industry-requests/actions";

export interface RequestRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  needs: string | null;
  ref_url: string | null;
  status: "received" | "reviewing" | "adopted" | "rejected";
  admin_note: string | null;
  public_reply: string | null;
  linked_industry_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}
export interface EventRow {
  id: string;
  request_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  received: "접수됨",
  reviewing: "검토 중",
  adopted: "채택",
  rejected: "반려",
};
const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "received", label: "접수됨" },
  { key: "reviewing", label: "검토 중" },
  { key: "adopted", label: "채택" },
  { key: "rejected", label: "반려" },
];

const field =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function AdminIndustryRequestsView({
  requests,
  events,
}: {
  requests: RequestRow[];
  events: EventRow[];
}) {
  const [filter, setFilter] = useState("all");
  const shown = useMemo(
    () => (filter === "all" ? requests : requests.filter((r) => r.status === filter)),
    [filter, requests],
  );
  const eventsByReq = useMemo(() => {
    const m = new Map<string, EventRow[]>();
    for (const e of events) {
      const arr = m.get(e.request_id) ?? [];
      arr.push(e);
      m.set(e.request_id, arr);
    }
    return m;
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface text-muted hover:border-primary/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          해당 상태의 요청이 없어요.
        </p>
      ) : (
        shown.map((r) => (
          <RequestCard key={r.id} r={r} events={eventsByReq.get(r.id) ?? []} />
        ))
      )}
    </div>
  );
}

function RequestCard({ r, events }: { r: RequestRow; events: EventRow[] }) {
  const router = useRouter();
  const [note, setNote] = useState(r.admin_note ?? "");
  const [reply, setReply] = useState(r.public_reply ?? "");
  const [adoptName, setAdoptName] = useState(r.name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const review = async (status: RequestRow["status"]) => {
    setBusy(true);
    setMsg(null);
    const res = await reviewIndustryRequestAction(r.id, {
      status,
      adminNote: note,
      publicReply: reply,
    });
    setBusy(false);
    if (res.error) setMsg(res.error);
    else router.refresh();
  };

  const adopt = async () => {
    setBusy(true);
    setMsg(null);
    const res = await adoptRequestAction(r.id, {
      nameKo: adoptName,
      publicReply: reply || undefined,
    });
    setBusy(false);
    if (res.error) setMsg(res.error);
    else router.refresh();
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{r.name}</h3>
        <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-muted">
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{r.description}</p>
      {r.needs && (
        <p className="mt-1.5 text-sm">
          <span className="text-muted">필요 기능: </span>
          {r.needs}
        </p>
      )}
      {r.ref_url && (
        <p className="mt-1.5 text-sm">
          <span className="text-muted">참고: </span>
          <a
            href={r.ref_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary hover:underline"
          >
            {r.ref_url}
          </a>
        </p>
      )}
      <p className="mt-1.5 text-xs text-muted">
        {new Date(r.created_at).toLocaleString("ko-KR")}
        {r.linked_industry_id ? " · 연결된 업종 있음" : ""}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">
          내부 메모(비공개)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={`${field} resize-none`}
          />
        </label>
        <label className="text-xs text-muted">
          신청자에게 보여줄 답변
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            className={`${field} resize-none`}
          />
        </label>
      </div>

      {msg && <p className="mt-2 text-sm text-danger">{msg}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => review("reviewing")} disabled={busy}>
          검토 중
        </Button>
        <Button size="sm" variant="outline" onClick={() => review("rejected")} disabled={busy}>
          반려
        </Button>
        <Button size="sm" variant="outline" onClick={() => review("received")} disabled={busy}>
          접수로 되돌리기
        </Button>
      </div>

      {/* 채택 → 업종 초안 생성·연결(발행은 업종 탭에서 별도). */}
      <div className="mt-3 rounded-xl border border-border bg-background p-3">
        <p className="text-xs font-medium text-muted">채택(업종 초안 생성·연결)</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            업종명
            <input
              value={adoptName}
              onChange={(e) => setAdoptName(e.target.value)}
              className={`${field} w-48`}
            />
          </label>
          <Button size="sm" onClick={adopt} disabled={busy}>
            채택하고 초안 만들기
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          채택해도 바로 공개되지 않아요. ‘업종’ 탭에서 콘텐츠를 검수한 뒤 발행하세요.
        </p>
      </div>

      {events.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted">
            처리 이력 ({events.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {events.map((e) => (
              <li key={e.id}>
                {new Date(e.created_at).toLocaleString("ko-KR")} ·{" "}
                {e.from_status ?? "—"} → {e.to_status}
                {e.note ? ` (${e.note})` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
