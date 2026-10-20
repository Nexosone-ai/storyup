"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { PageSchemaRenderer } from "@/components/marketplace/PageSchemaRenderer";
import {
  type ComponentNode,
  type ComponentType,
  type PageSchema,
} from "@/lib/marketplace/pageSchema";
import { UXUI_PROMPTS } from "@/lib/marketplace/prompts";
import {
  saveTemplateVersion,
  submitTemplateVersion,
  aiEditSchemaAction,
  applySkillToSchemaAction,
} from "@/app/partner/designer/actions";

export interface EditorSkill {
  id: string;
  name: string;
  description: string | null;
}

type Sel = { s: number; r: number; c: number; i: number } | null;
type Device = "mobile" | "tablet" | "desktop";
const DEVICE_W: Record<Device, number | null> = { mobile: 375, tablet: 768, desktop: null };

const ADDABLE: { type: ComponentType; label: string }[] = [
  { type: "heading", label: "제목" },
  { type: "text", label: "문단" },
  { type: "button", label: "버튼" },
  { type: "image", label: "이미지" },
  { type: "card", label: "카드" },
  { type: "list", label: "목록" },
  { type: "spacer", label: "여백" },
  { type: "divider", label: "구분선" },
];

function blank(type: ComponentType): ComponentNode {
  switch (type) {
    case "heading":
      return { type: "heading", level: 2, text: "제목" };
    case "text":
      return { type: "text", html: "내용을 입력하세요." };
    case "button":
      return { type: "button", label: "버튼", style: "primary" };
    case "image":
      return { type: "image", src: "/images/demo/demo-hero.jpg", alt: "" };
    case "card":
      return { type: "card", title: "카드 제목", body: "카드 설명" };
    case "list":
      return { type: "list", ordered: false, items: ["항목 1", "항목 2"] };
    case "spacer":
      return { type: "spacer", size: 4 };
    default:
      return { type: "divider" };
  }
}

const clone = (s: PageSchema): PageSchema =>
  typeof structuredClone === "function"
    ? structuredClone(s)
    : (JSON.parse(JSON.stringify(s)) as PageSchema);

function SortableSectionItem({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="rounded-lg border border-border p-2"
    >
      {!disabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mb-1 cursor-grab text-[11px] text-muted"
          aria-label="섹션 드래그로 이동"
        >
          ⠿ 드래그로 이동
        </button>
      )}
      {children}
    </div>
  );
}

export function TemplateEditor({
  versionId,
  title,
  status,
  initialSchema,
  aiPrice = 0,
  skills = [],
}: {
  versionId: string;
  title: string;
  status: string;
  initialSchema: PageSchema;
  aiPrice?: number;
  skills?: EditorSkill[];
}) {
  const router = useRouter();
  const [schema, setSchema] = useState<PageSchema>(initialSchema);
  const [sel, setSel] = useState<Sel>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const readOnly = status !== "draft";

  // AI 수정: 제안(aiProposed)을 미리보기로 보여주고 승인 시 적용. beforeAi로 롤백.
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, startAi] = useTransition();
  const [aiProposed, setAiProposed] = useState<PageSchema | null>(null);
  const [beforeAi, setBeforeAi] = useState<PageSchema | null>(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [skillId, setSkillId] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSchema((prev) => {
      const from = prev.sections.findIndex((s) => s.id === active.id);
      const to = prev.sections.findIndex((s) => s.id === over.id);
      if (from < 0 || to < 0) return prev;
      const next = clone(prev);
      next.sections = arrayMove(next.sections, from, to);
      return next;
    });
  };

  const tokenKeys = Object.keys(schema.tokens.colors);
  const selected =
    sel && schema.sections[sel.s]?.rows[sel.r]?.columns[sel.c]?.components[sel.i];

  const mutate = (fn: (d: PageSchema) => void) => {
    const next = clone(schema);
    fn(next);
    setSchema(next);
  };

  const addSection = () =>
    mutate((d) => {
      d.sections.push({
        id: `sec_${Date.now()}`,
        rows: [{ columns: [{ span: 12, components: [] }] }],
      });
    });
  const moveSection = (idx: number, dir: -1 | 1) =>
    mutate((d) => {
      const j = idx + dir;
      if (j < 0 || j >= d.sections.length) return;
      [d.sections[idx], d.sections[j]] = [d.sections[j], d.sections[idx]];
    });
  const delSection = (idx: number) =>
    mutate((d) => {
      d.sections.splice(idx, 1);
    });
  const addComponent = (s: number, r: number, c: number, type: ComponentType) =>
    mutate((d) => {
      d.sections[s].rows[r].columns[c].components.push(blank(type));
    });
  const delComponent = () => {
    if (!sel) return;
    mutate((d) => {
      d.sections[sel.s].rows[sel.r].columns[sel.c].components.splice(sel.i, 1);
    });
    setSel(null);
  };

  const patchSelected = (patch: Record<string, unknown>) => {
    if (!sel) return;
    mutate((d) => {
      const col = d.sections[sel.s].rows[sel.r].columns[sel.c];
      col.components[sel.i] = { ...col.components[sel.i], ...patch } as ComponentNode;
    });
  };

  const setSectionBg = (s: number, bg: string) =>
    mutate((d) => {
      const sec = d.sections[s];
      sec.layout = { ...(sec.layout ?? { base: {} }), base: { ...(sec.layout?.base ?? {}), background: bg || undefined } };
    });

  const save = () => {
    setMsg(null);
    start(async () => {
      const res = await saveTemplateVersion(versionId, schema);
      setMsg(res.error ?? (res.ok ? "저장됐어요." : "저장 실패"));
    });
  };
  const submit = () => {
    setMsg(null);
    start(async () => {
      const r1 = await saveTemplateVersion(versionId, schema);
      if (r1.error) return setMsg(r1.error);
      const r2 = await submitTemplateVersion(versionId);
      if (r2.error) return setMsg(r2.error);
      setMsg("심사 요청됐어요.");
      router.refresh();
    });
  };

  // AI 수정 — 제안 생성(저장 안 함) → 미리보기 → 적용/취소.
  const runAi = () => {
    const text = aiInput.trim();
    if (!text) return;
    setAiMsg(null);
    startAi(async () => {
      const res = await aiEditSchemaAction(text, schema);
      if (res.error || !res.schema) {
        setAiMsg(res.error ?? "수정에 실패했어요.");
        return;
      }
      setAiProposed(res.schema);
    });
  };
  // 프롬프트 프리셋 — 빈 캔버스 대신 박스를 눌러 섹션을 AI로 구성(제안 미리보기).
  const runPreset = (prompt: string) => {
    setAiMsg(null);
    startAi(async () => {
      const res = await aiEditSchemaAction(prompt, schema);
      if (res.error || !res.schema) {
        setAiMsg(res.error ?? "구성에 실패했어요.");
        return;
      }
      setAiProposed(res.schema);
    });
  };
  // Skill 적용 — 보관함의 지침형 Skill을 현재 디자인에 AI 패치로 반영(제안 미리보기).
  const runSkill = () => {
    if (!skillId) return;
    setAiMsg(null);
    startAi(async () => {
      const res = await applySkillToSchemaAction(skillId, schema, aiInput.trim() || undefined);
      if (res.error || !res.schema) {
        setAiMsg(res.error ?? "Skill 적용에 실패했어요.");
        return;
      }
      setAiProposed(res.schema);
    });
  };

  const applyAi = () => {
    if (!aiProposed) return;
    setBeforeAi(schema);
    setSchema(aiProposed);
    setAiProposed(null);
    setAiInput("");
    setSel(null);
    setAiMsg("AI 수정을 적용했어요. '저장'을 눌러 반영하세요.");
  };
  const cancelAi = () => {
    setAiProposed(null);
    setAiMsg(null);
  };
  const rollbackAi = () => {
    if (!beforeAi) return;
    setSchema(beforeAi);
    setBeforeAi(null);
    setSel(null);
    setAiMsg("이전 디자인으로 되돌렸어요.");
  };

  const frameW = DEVICE_W[device];
  const previewSchema = aiProposed ?? schema;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow mb-1">템플릿 편집</p>
          <h1 className="text-lg font-semibold">{title || "제목 없음"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {(["mobile", "tablet", "desktop"] as Device[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className={`rounded-md border px-2 py-1 text-xs ${device === d ? "border-primary text-primary" : "border-border text-muted"}`}
            >
              {d === "mobile" ? "모바일" : d === "tablet" ? "태블릿" : "데스크톱"}
            </button>
          ))}
          <Button size="sm" variant="outline" onClick={save} disabled={busy || readOnly}>
            {busy ? <Spinner className="size-4" /> : "저장"}
          </Button>
          <Button size="sm" onClick={submit} disabled={busy || readOnly}>
            심사 요청
          </Button>
        </div>
      </div>

      {readOnly && (
        <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
          심사 중이거나 확정된 버전은 편집할 수 없어요(보기 전용). 수정은 새 버전으로 진행됩니다.
        </p>
      )}
      {msg && <p className="text-sm text-primary">{msg}</p>}

      {/* AI 수정 패널 */}
      {!readOnly && (
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="AI에게 수정 요청 (예: 카페용 따뜻한 톤으로, 모바일 CTA 강조)"
              disabled={aiBusy || !!aiProposed}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <Button size="sm" onClick={runAi} disabled={aiBusy || !!aiProposed || !aiInput.trim()}>
              {aiBusy ? <Spinner className="size-4" /> : "AI로 수정"}
            </Button>
            {beforeAi && !aiProposed && (
              <Button size="sm" variant="outline" onClick={rollbackAi} disabled={aiBusy}>
                이전으로 되돌리기
              </Button>
            )}
          </div>
          {skills.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
              <span className="text-xs font-medium text-muted">Skill 적용</span>
              <select
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                disabled={aiBusy || !!aiProposed}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-60"
              >
                <option value="">보관함 Skill 선택…</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={runSkill}
                disabled={aiBusy || !!aiProposed || !skillId}
              >
                {aiBusy ? <Spinner className="size-4" /> : "적용"}
              </Button>
            </div>
          )}
          {/* 프롬프트로 구성 — 박스를 눌러 섹션을 AI로 추가(빈 캔버스 대안) */}
          <div className="mt-2 border-t border-border pt-2">
            <p className="mb-1.5 text-xs font-medium text-muted">프롬프트로 구성</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {UXUI_PROMPTS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => runPreset(p.prompt)}
                  disabled={aiBusy || !!aiProposed}
                  title={p.hint}
                  className="rounded-lg border border-border bg-background px-2.5 py-2 text-left transition-colors hover:border-primary/60 hover:bg-surface disabled:opacity-60"
                >
                  <span className="block truncate text-xs font-semibold">{p.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {aiPrice > 0
              ? `요청 1건당 ${aiPrice.toLocaleString()} UP 차감(실패 시 환급). `
              : ""}
            제안을 미리보기로 확인한 뒤 적용하며, 적용 후 되돌릴 수 있어요.
          </p>
          {aiMsg && <p className="mt-1 text-xs text-primary">{aiMsg}</p>}
        </div>
      )}

      {/* AI 제안 미리보기 바 */}
      {aiProposed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium text-primary">
            AI 제안을 미리보기 중이에요. 적용할까요?
          </span>
          <span className="flex gap-2">
            <Button size="sm" onClick={applyAi}>적용</Button>
            <Button size="sm" variant="outline" onClick={cancelAi}>취소</Button>
          </span>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[220px_1fr_240px]">
        {/* 좌: 구조 트리 */}
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">구조</span>
            <button
              type="button"
              onClick={addSection}
              disabled={readOnly}
              className="text-xs text-primary disabled:opacity-50"
            >
              + 섹션
            </button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={schema.sections.map((sc) => sc.id)}
            strategy={verticalListSortingStrategy}
          >
          {schema.sections.map((sec, s) => (
            <SortableSectionItem key={sec.id} id={sec.id} disabled={readOnly}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted">섹션 {s + 1}</span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => moveSection(s, -1)} disabled={readOnly}>↑</button>
                  <button type="button" onClick={() => moveSection(s, 1)} disabled={readOnly}>↓</button>
                  <button type="button" onClick={() => delSection(s)} disabled={readOnly} className="text-danger">✕</button>
                </span>
              </div>
              {sec.rows.map((rw, r) =>
                rw.columns.map((col, c) => (
                  <div key={`${r}-${c}`} className="mt-1">
                    {col.components.map((cmp, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSel({ s, r, c, i })}
                        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-xs ${sel && sel.s === s && sel.r === r && sel.c === c && sel.i === i ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-muted"}`}
                      >
                        {cmp.type}
                      </button>
                    ))}
                    {!readOnly && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) addComponent(s, r, c, e.target.value as ComponentType);
                          e.target.value = "";
                        }}
                        className="mt-1 w-full rounded border border-border bg-background px-1 py-0.5 text-[11px] text-muted"
                      >
                        <option value="">+ 추가</option>
                        {ADDABLE.map((a) => (
                          <option key={a.type} value={a.type}>{a.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )),
              )}
              {!readOnly && (
                <label className="mt-2 block text-[11px] text-muted">
                  배경
                  <select
                    value={sec.layout?.base?.background ?? ""}
                    onChange={(e) => setSectionBg(s, e.target.value)}
                    className="mt-0.5 w-full rounded border border-border bg-background px-1 py-0.5"
                  >
                    <option value="">없음</option>
                    <option value="transparent">투명</option>
                    {tokenKeys.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </label>
              )}
            </SortableSectionItem>
          ))}
          </SortableContext>
          </DndContext>
        </div>

        {/* 중: 미리보기 */}
        <div className="overflow-auto rounded-xl border border-border bg-surface-muted/30 p-3">
          <div
            className="mx-auto overflow-hidden rounded-lg border border-border bg-white shadow-sm"
            style={{ width: frameW ?? "100%", maxWidth: "100%" }}
          >
            <PageSchemaRenderer schema={previewSchema} />
          </div>
        </div>

        {/* 우: 속성 */}
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3 text-sm">
          <span className="font-semibold">속성</span>
          {!selected ? (
            <p className="text-xs text-muted">편집할 요소를 왼쪽에서 선택하세요.</p>
          ) : (
            <PropertyPanel
              node={selected}
              readOnly={readOnly}
              onPatch={patchSelected}
              onDelete={delComponent}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <div className="mt-0.5">{children}</div>
    </label>
  );
}
const inputCls =
  "w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary";

function PropertyPanel({
  node,
  readOnly,
  onPatch,
  onDelete,
}: {
  node: ComponentNode;
  readOnly: boolean;
  onPatch: (p: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const d = readOnly;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-foreground">{node.type}</p>
      {node.type === "heading" && (
        <>
          <Field label="레벨">
            <select
              disabled={d}
              value={node.level}
              onChange={(e) => onPatch({ level: Number(e.target.value) as 1 | 2 | 3 | 4 })}
              className={inputCls}
            >
              {[1, 2, 3, 4].map((l) => (
                <option key={l} value={l}>H{l}</option>
              ))}
            </select>
          </Field>
          <Field label="텍스트">
            <input disabled={d} value={node.text} onChange={(e) => onPatch({ text: e.target.value })} className={inputCls} />
          </Field>
        </>
      )}
      {node.type === "text" && (
        <Field label="내용">
          <textarea disabled={d} value={node.html} onChange={(e) => onPatch({ html: e.target.value })} rows={4} className={inputCls} />
        </Field>
      )}
      {node.type === "button" && (
        <>
          <Field label="문구">
            <input disabled={d} value={node.label} onChange={(e) => onPatch({ label: e.target.value })} className={inputCls} />
          </Field>
          <Field label="링크(선택)">
            <input disabled={d} value={node.href ?? ""} onChange={(e) => onPatch({ href: e.target.value })} className={inputCls} placeholder="https:// 또는 /" />
          </Field>
          <Field label="스타일">
            <select disabled={d} value={node.style ?? "primary"} onChange={(e) => onPatch({ style: e.target.value as "primary" | "outline" | "ghost" })} className={inputCls}>
              <option value="primary">강조</option>
              <option value="outline">외곽선</option>
              <option value="ghost">연하게</option>
            </select>
          </Field>
        </>
      )}
      {node.type === "image" && (
        <>
          <Field label="이미지 주소">
            <input disabled={d} value={node.src} onChange={(e) => onPatch({ src: e.target.value })} className={inputCls} placeholder="https:// 또는 /" />
          </Field>
          <Field label="대체 텍스트">
            <input disabled={d} value={node.alt} onChange={(e) => onPatch({ alt: e.target.value })} className={inputCls} />
          </Field>
        </>
      )}
      {node.type === "card" && (
        <>
          <Field label="제목">
            <input disabled={d} value={node.title ?? ""} onChange={(e) => onPatch({ title: e.target.value })} className={inputCls} />
          </Field>
          <Field label="설명">
            <textarea disabled={d} value={node.body ?? ""} onChange={(e) => onPatch({ body: e.target.value })} rows={3} className={inputCls} />
          </Field>
        </>
      )}
      {node.type === "list" && (
        <Field label="항목(줄마다)">
          <textarea
            disabled={d}
            value={node.items.join("\n")}
            onChange={(e) => onPatch({ items: e.target.value.split("\n") })}
            rows={4}
            className={inputCls}
          />
        </Field>
      )}
      {node.type === "spacer" && (
        <Field label="크기">
          <input
            type="number"
            disabled={d}
            value={node.size}
            onChange={(e) => onPatch({ size: Math.max(0, Number(e.target.value)) })}
            className={inputCls}
          />
        </Field>
      )}
      {!readOnly && (
        <button type="button" onClick={onDelete} className="mt-2 text-xs text-danger">
          이 요소 삭제
        </button>
      )}
    </div>
  );
}
