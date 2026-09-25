"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { AnnouncementBody } from "@/components/announcements/AnnouncementBody";
import {
  saveAnnouncementAction,
  setAnnouncementActiveAction,
  deleteAnnouncementAction,
} from "@/app/dashboard/admin/announcements/actions";
import type { AnnouncementRow } from "@/types/database";

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO → datetime-local 입력값(로컬 시간, 분 단위). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** 지금(+offsetDays)을 datetime-local 입력값으로. */
function nowInput(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FormState {
  id: string | null;
  title: string;
  body: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

const emptyForm = (): FormState => ({
  id: null,
  title: "",
  body: "",
  imageUrl: "",
  linkUrl: "",
  linkLabel: "",
  startsAt: nowInput(),
  endsAt: nowInput(7),
  active: true,
});

function statusOf(a: AnnouncementRow): { label: string; tone: "success" | "warning" | "muted" } {
  const now = Date.now();
  if (!a.active) return { label: "비활성", tone: "muted" };
  if (new Date(a.starts_at).getTime() > now) return { label: "예정", tone: "warning" };
  if (new Date(a.ends_at).getTime() < now) return { label: "종료", tone: "muted" };
  return { label: "노출중", tone: "success" };
}

export function AdminAnnouncementsView({ items }: { items: AnnouncementRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, start] = useTransition();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const editing = form.id !== null;

  const loadForEdit = (a: AnnouncementRow) => {
    setNote(null);
    setForm({
      id: a.id,
      title: a.title,
      body: a.body,
      imageUrl: a.image_url ?? "",
      linkUrl: a.link_url ?? "",
      linkLabel: a.link_label ?? "",
      startsAt: toLocalInput(a.starts_at),
      endsAt: toLocalInput(a.ends_at),
      active: a.active,
    });
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setForm(emptyForm());
    setNote(null);
  };

  const save = () =>
    start(async () => {
      setNote(null);
      const res = await saveAnnouncementAction(form.id, {
        title: form.title,
        body: form.body,
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl,
        linkLabel: form.linkLabel,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        active: form.active,
      });
      setNote({ text: res.error ?? res.message ?? "저장했습니다.", error: !!res.error });
      if (!res.error) {
        reset();
        router.refresh();
      }
    });

  const toggle = (a: AnnouncementRow) =>
    start(async () => {
      const res = await setAnnouncementActiveAction(a.id, !a.active);
      if (res.error) setNote({ text: res.error, error: true });
      else router.refresh();
    });

  const remove = (a: AnnouncementRow) => {
    if (!window.confirm(`'${a.title}' 공지를 삭제할까요?`)) return;
    start(async () => {
      const res = await deleteAnnouncementAction(a.id);
      if (res.error) setNote({ text: res.error, error: true });
      else {
        if (form.id === a.id) reset();
        router.refresh();
      }
    });
  };

  // 미리보기용 콘텐츠 (링크 문구 기본값은 저장 규칙과 동일하게)
  const previewLink = form.linkUrl.trim();
  const preview = {
    title: form.title,
    body: form.body,
    imageUrl: form.imageUrl.trim() || null,
    linkUrl: previewLink || null,
    linkLabel: previewLink ? form.linkLabel.trim() || "자세히 보기" : null,
  };

  return (
    <section className="space-y-8">
      <div>
        <p className="eyebrow mb-2">공지팝업</p>
        <h2 className="text-xl font-semibold tracking-tight">공지 팝업 관리</h2>
        <p className="mt-1 text-sm text-muted">
          로그인한 사용자에게 노출 기간 동안 팝업으로 보여집니다. 사용자는 &lsquo;오늘
          하루 보지 않기&rsquo;로 닫을 수 있어요.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 작성/수정 폼 */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{editing ? "공지 수정" : "새 공지 작성"}</p>
            {editing && (
              <button
                type="button"
                onClick={reset}
                className="text-xs font-medium text-muted hover:text-foreground"
              >
                + 새로 작성
              </button>
            )}
          </div>

          <div>
            <Label htmlFor="a-title">제목</Label>
            <Input
              id="a-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="예) 추석 연휴 고객센터 운영 안내"
              maxLength={120}
            />
          </div>

          <div>
            <Label htmlFor="a-body">내용</Label>
            <Textarea
              id="a-body"
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder="공지 내용을 입력하세요. 줄바꿈은 그대로 표시됩니다."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="a-image">이미지 URL (선택)</Label>
            <Input
              id="a-image"
              value={form.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              placeholder="https://…/banner.png"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="a-link">버튼 링크 (선택)</Label>
              <Input
                id="a-link"
                value={form.linkUrl}
                onChange={(e) => set("linkUrl", e.target.value)}
                placeholder="/dashboard/points 또는 https://…"
              />
            </div>
            <div>
              <Label htmlFor="a-linklabel">버튼 문구</Label>
              <Input
                id="a-linklabel"
                value={form.linkLabel}
                onChange={(e) => set("linkLabel", e.target.value)}
                placeholder="자세히 보기"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="a-start">노출 시작</Label>
              <Input
                id="a-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="a-end">노출 종료</Label>
              <Input
                id="a-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="size-4 rounded border-border"
            />
            활성 (기간 내라도 꺼두면 표시되지 않음)
          </label>

          {note && (
            <p className={`text-sm ${note.error ? "text-danger" : "text-primary"}`}>
              {note.text}
            </p>
          )}

          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>
              {busy ? <Spinner className="size-4" /> : editing ? "수정 저장" : "공지 등록"}
            </Button>
            {editing && (
              <Button variant="outline" onClick={reset} disabled={busy}>
                취소
              </Button>
            )}
          </div>
        </Card>

        {/* 실시간 미리보기 */}
        <div>
          <p className="mb-2 text-sm font-semibold text-muted">미리보기</p>
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <AnnouncementBody content={preview} />
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted">
              <span>오늘 하루 보지 않기</span>
              <span className="font-semibold text-primary">닫기</span>
            </div>
          </div>
        </div>
      </div>

      {/* 등록된 공지 목록 */}
      <div className="space-y-3">
        <p className="font-semibold">등록된 공지 ({items.length})</p>
        {items.length === 0 ? (
          <p className="text-sm text-muted">아직 등록된 공지가 없습니다.</p>
        ) : (
          items.map((a) => {
            const s = statusOf(a);
            return (
              <Card key={a.id} className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <p className="truncate font-medium">{a.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {fmt(a.starts_at)} ~ {fmt(a.ends_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => loadForEdit(a)} disabled={busy}>
                    수정
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(a)} disabled={busy}>
                    {a.active ? "끄기" : "켜기"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(a)} disabled={busy}>
                    삭제
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}
