"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { Database } from "@/types/database";
import {
  upsertIndustryAction,
  setIndustryStatusAction,
  deleteIndustryAction,
  type AdminIndustryInput,
} from "@/app/dashboard/admin/industries/actions";

type Row = Database["public"]["Tables"]["industries"]["Row"];

const field =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

const EMPTY: AdminIndustryInput = {
  nameKo: "",
  nameEn: "",
  icon: "",
  summaryKo: "",
  summaryEn: "",
  sortOrder: 100,
  status: "draft",
  mapsCategory: null,
  mapsIndustry: null,
  sensitive: false,
  contentJson: "",
};

export function AdminIndustriesView({
  industries,
  categories,
  industryIds,
}: {
  industries: Row[];
  categories: string[];
  industryIds: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<AdminIndustryInput>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = <K extends keyof AdminIndustryInput>(
    k: K,
    v: AdminIndustryInput[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  const startEdit = (r: Row) => {
    setEditing(r.id);
    setForm({
      id: r.id,
      slug: r.slug,
      nameKo: r.name_ko,
      nameEn: r.name_en,
      icon: r.icon,
      summaryKo: r.summary_ko,
      summaryEn: r.summary_en,
      sortOrder: r.sort_order,
      status: r.status,
      mapsCategory: r.maps_category,
      mapsIndustry: r.maps_industry,
      sensitive: r.sensitive,
      contentJson: r.content ? JSON.stringify(r.content, null, 2) : "",
    });
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setEditing(null);
    setForm(EMPTY);
    setMsg(null);
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await upsertIndustryAction(form);
    setBusy(false);
    if (res.error) setMsg(res.error);
    else {
      reset();
      router.refresh();
    }
  };

  const toggleStatus = async (r: Row) => {
    setBusy(true);
    await setIndustryStatusAction(
      r.id,
      r.status === "published" ? "draft" : "published",
    );
    setBusy(false);
    router.refresh();
  };

  const remove = async (r: Row) => {
    if (!confirm(`'${r.name_ko}' 업종을 삭제할까요?`)) return;
    setBusy(true);
    await deleteIndustryAction(r.id);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">
          {editing ? "업종 수정" : "새 업종 추가"}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            업종명(한글) *
            <input
              value={form.nameKo}
              onChange={(e) => set("nameKo", e.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs text-muted">
            업종명(영문)
            <input
              value={form.nameEn ?? ""}
              onChange={(e) => set("nameEn", e.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs text-muted">
            아이콘(이모지)
            <input
              value={form.icon ?? ""}
              onChange={(e) => set("icon", e.target.value)}
              placeholder="🍽️"
              className={field}
            />
          </label>
          <label className="text-xs text-muted">
            정렬 순서
            <input
              type="number"
              value={form.sortOrder ?? 100}
              onChange={(e) => set("sortOrder", Number(e.target.value))}
              className={field}
            />
          </label>
          <label className="text-xs text-muted sm:col-span-2">
            한 줄 설명(한글)
            <input
              value={form.summaryKo ?? ""}
              onChange={(e) => set("summaryKo", e.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs text-muted sm:col-span-2">
            한 줄 설명(영문)
            <input
              value={form.summaryEn ?? ""}
              onChange={(e) => set("summaryEn", e.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs text-muted">
            시작 기본값 — 카테고리
            <select
              value={form.mapsCategory ?? ""}
              onChange={(e) => set("mapsCategory", e.target.value || null)}
              className={field}
            >
              <option value="">(없음)</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            시작 기본값 — 분류
            <select
              value={form.mapsIndustry ?? ""}
              onChange={(e) => set("mapsIndustry", e.target.value || null)}
              className={field}
            >
              <option value="">(없음)</option>
              {industryIds.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={!!form.sensitive}
              onChange={(e) => set("sensitive", e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            전문가 검토 필요 분야(의료·금융 등)
          </label>
          <label className="text-xs text-muted">
            상태
            <select
              value={form.status ?? "draft"}
              onChange={(e) =>
                set("status", e.target.value === "published" ? "published" : "draft")
              }
              className={field}
            >
              <option value="draft">초안(비공개)</option>
              <option value="published">공개</option>
            </select>
          </label>
          <label className="text-xs text-muted sm:col-span-2">
            상세 콘텐츠 오버라이드(JSON, 선택 — 비우면 기본 콘텐츠 사용)
            <textarea
              value={form.contentJson ?? ""}
              onChange={(e) => set("contentJson", e.target.value)}
              rows={6}
              placeholder='{"headline":"...","sub":"...","concerns":[...],"flow":[...],"channels":[...],"inputs":[...],"topics":[...],"sample":{...},"faq":[...]}'
              className={`${field} resize-y font-mono text-xs`}
            />
          </label>
        </div>
        {msg && <p className="mt-2 text-sm text-danger">{msg}</p>}
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={busy}>
            {editing ? "저장" : "추가"}
          </Button>
          {editing && (
            <Button size="sm" variant="outline" onClick={reset} disabled={busy}>
              취소
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">업종 목록 ({industries.length})</h2>
        <ul className="mt-3 space-y-2">
          {industries.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="mr-1.5">{r.icon}</span>
                <span className="font-medium">{r.name_ko}</span>
                <span className="ml-2 text-xs text-muted">/{r.slug}</span>
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${
                    r.status === "published"
                      ? "bg-primary-soft text-primary"
                      : "bg-surface-muted text-muted"
                  }`}
                >
                  {r.status === "published" ? "공개" : "초안"}
                </span>
                {r.sensitive && (
                  <span className="ml-1.5 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                    검토필요
                  </span>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => startEdit(r)}
                  disabled={busy}
                  className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs hover:border-primary"
                >
                  수정
                </button>
                <button
                  onClick={() => toggleStatus(r)}
                  disabled={busy}
                  className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs hover:border-primary"
                >
                  {r.status === "published" ? "비공개" : "발행"}
                </button>
                <a
                  href={`/industries/${r.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs hover:border-primary"
                >
                  보기
                </a>
                <button
                  onClick={() => remove(r)}
                  disabled={busy}
                  className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-muted hover:text-danger"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
