"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { DocumentRenderer } from "@/components/marketplace/DocumentRenderer";
import {
  pathTo,
  type DesignDocument,
  type DocNode,
  type NodeId,
  type NodeType,
  type StyleProps,
} from "@/lib/marketplace/document";
import {
  newLeaf,
  newContainer,
  insertNode,
  removeNode,
  updateProps,
  updateStyle,
  toggleLock,
  moveChild,
  duplicateNode,
  parentId,
} from "@/lib/marketplace/docOps";
import { saveTemplateDocument } from "@/app/partner/designer/actions";

type Device = "base" | "mobile" | "tablet" | "desktop";
const DEVICE_LABEL: Record<Device, string> = {
  base: "기본",
  mobile: "모바일",
  tablet: "태블릿",
  desktop: "데스크톱",
};
const DEVICE_W: Record<Device, number | null> = { base: null, mobile: 375, tablet: 768, desktop: null };

const ADD_LEAF: { type: NodeType; label: string }[] = [
  { type: "heading", label: "제목" },
  { type: "text", label: "문단" },
  { type: "button", label: "버튼" },
  { type: "image", label: "이미지" },
  { type: "card", label: "카드" },
  { type: "list", label: "목록" },
  { type: "spacer", label: "여백" },
  { type: "divider", label: "구분선" },
];

const TYPE_KO: Record<string, string> = {
  page: "페이지",
  section: "섹션",
  container: "컨테이너",
  heading: "제목",
  text: "문단",
  image: "이미지",
  button: "버튼",
  list: "목록",
  card: "카드",
  spacer: "여백",
  divider: "구분선",
};

export function DocumentEditor({
  versionId,
  title,
  status,
  initialDoc,
}: {
  versionId: string;
  title: string;
  status: string;
  initialDoc: DesignDocument;
}) {
  const [doc, setDoc] = useState<DesignDocument>(initialDoc);
  const [past, setPast] = useState<DesignDocument[]>([]);
  const [future, setFuture] = useState<DesignDocument[]>([]);
  const [sel, setSel] = useState<NodeId | null>(initialDoc.root);
  const [device, setDevice] = useState<Device>("base");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const readOnly = status !== "draft";

  const node = sel ? doc.nodes[sel] : null;
  const isContainer = node?.type === "page" || node?.type === "section" || node?.type === "container";

  const apply = (next: DesignDocument) => {
    if (next === doc) return;
    setPast((p) => [...p.slice(-49), doc]);
    setFuture([]);
    setDoc(next);
  };
  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [doc, ...f]);
      setDoc(prev);
      return p.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, doc]);
      setDoc(next);
      return f.slice(1);
    });
  };

  // 편집 중 캔버스 클릭 = 노드 선택(링크·버튼·폼 동작 차단).
  const onCanvasClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-n]") as HTMLElement | null;
    e.preventDefault();
    e.stopPropagation();
    if (el?.dataset.n) setSel(el.dataset.n);
  };

  const addTo = (parent: NodeId, kind: NodeType | "container" | "section") => {
    if (readOnly) return;
    const n = kind === "container" || kind === "section" ? newContainer(kind) : newLeaf(kind);
    apply(insertNode(doc, parent, n));
    setSel(n.id);
  };

  // 선택 노드의 현재 device 레이어 스타일 값(없으면 base 상속).
  const sval = <K extends keyof StyleProps>(k: K): StyleProps[K] | undefined => {
    if (!node) return undefined;
    const layer = node.style?.[device];
    if (layer && layer[k] != null) return layer[k];
    return device === "base" ? node.style?.base?.[k] : node.style?.base?.[k];
  };
  const overridden = (k: keyof StyleProps): boolean =>
    device !== "base" && node?.style?.[device]?.[k] != null;
  const setStyle = (patch: Partial<StyleProps>) => {
    if (!node || readOnly) return;
    apply(updateStyle(doc, node.id, device, patch));
  };
  const setProp = (patch: Record<string, unknown>) => {
    if (!node || readOnly) return;
    apply(updateProps(doc, node.id, patch));
  };

  const save = () => {
    setMsg(null);
    start(async () => {
      const res = await saveTemplateDocument(versionId, doc);
      setMsg(res.error ?? (res.ok ? "저장됐어요." : "저장 실패"));
    });
  };

  const frameW = DEVICE_W[device];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow mb-1">문서 편집기 (V2)</p>
          <h1 className="text-lg font-semibold">{title || "제목 없음"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={undo} disabled={busy || past.length === 0} className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40">↩ 취소</button>
          <button type="button" onClick={redo} disabled={busy || future.length === 0} className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40">↪ 다시</button>
          {(["base", "mobile", "tablet", "desktop"] as Device[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className={`rounded-md border px-2 py-1 text-xs ${device === d ? "border-primary text-primary" : "border-border text-muted"}`}
            >
              {DEVICE_LABEL[d]}
            </button>
          ))}
          <Button size="sm" onClick={save} disabled={busy || readOnly}>
            {busy ? <Spinner className="size-4" /> : "저장"}
          </Button>
        </div>
      </div>

      {readOnly && (
        <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
          심사 중이거나 확정된 버전은 편집할 수 없어요(보기 전용).
        </p>
      )}
      {device !== "base" && (
        <p className="text-xs text-muted">
          <b>{DEVICE_LABEL[device]}</b> 화면 편집 중 — 이 화면에서 바꾼 값만 저장되고, 나머지는 ‘기본’을 상속해요.
        </p>
      )}
      {msg && <p className="text-sm text-primary">{msg}</p>}

      {/* 브레드크럼 */}
      {sel && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
          {pathTo(doc, sel).map((id, i, arr) => (
            <span key={id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSel(id)}
                className={id === sel ? "font-medium text-primary" : "hover:text-foreground"}
              >
                {TYPE_KO[doc.nodes[id]?.type ?? ""] ?? doc.nodes[id]?.type}
              </button>
              {i < arr.length - 1 && <span>›</span>}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[220px_1fr_260px]">
        {/* 좌: 레이어 트리 */}
        <div className="max-h-[70vh] space-y-1 overflow-auto rounded-xl border border-border bg-surface p-2 text-sm">
          <LayerNode doc={doc} id={doc.root} depth={0} sel={sel} onSelect={setSel} />
        </div>

        {/* 중: 캔버스 */}
        <div className="overflow-auto rounded-xl border border-border bg-surface-muted/30 p-3">
          <div
            onClickCapture={onCanvasClick}
            className="mx-auto overflow-hidden rounded-lg border border-border bg-white shadow-sm"
            style={{ width: frameW ?? "100%", maxWidth: "100%" }}
          >
            {sel && (
              <style
                dangerouslySetInnerHTML={{
                  __html: `[data-n="${sel}"]{outline:2px solid #4f46e5;outline-offset:-2px}[data-n]:hover{outline:1px dashed rgba(79,70,229,.45);outline-offset:-1px;cursor:pointer}`,
                }}
              />
            )}
            <DocumentRenderer doc={doc} />
          </div>
        </div>

        {/* 우: 속성 + 레이아웃 */}
        <div className="max-h-[70vh] space-y-3 overflow-auto rounded-xl border border-border bg-surface p-3 text-sm">
          {!node ? (
            <p className="text-xs text-muted">편집할 요소를 선택하세요.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{TYPE_KO[node.type] ?? node.type}</span>
                <span className="flex gap-2 text-xs">
                  {node.id !== doc.root && (
                    <>
                      <button type="button" onClick={() => !readOnly && apply(moveChild(doc, node.id, -1))} disabled={readOnly}>↑</button>
                      <button type="button" onClick={() => !readOnly && apply(moveChild(doc, node.id, 1))} disabled={readOnly}>↓</button>
                      <button
                        type="button"
                        onClick={() => {
                          if (readOnly) return;
                          const r = duplicateNode(doc, node.id);
                          apply(r.doc);
                          setSel(r.newId);
                        }}
                        disabled={readOnly}
                      >
                        복제
                      </button>
                      <button type="button" onClick={() => !readOnly && apply(toggleLock(doc, node.id))} disabled={readOnly}>
                        {node.locked ? "🔒" : "🔓"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (readOnly) return;
                          const pid = parentId(doc, node.id);
                          apply(removeNode(doc, node.id));
                          setSel(pid);
                        }}
                        disabled={readOnly}
                        className="text-danger"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </span>
              </div>

              {/* 컨테이너: 자식 추가 */}
              {isContainer && !readOnly && (
                <div className="rounded-lg border border-border p-2">
                  <p className="mb-1 text-[11px] text-muted">자식 추가</p>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => addTo(node.id, "container")} className="rounded border border-border px-1.5 py-0.5 text-[11px]">+ 박스</button>
                    {node.type === "page" && (
                      <button type="button" onClick={() => addTo(node.id, "section")} className="rounded border border-border px-1.5 py-0.5 text-[11px]">+ 섹션</button>
                    )}
                    {ADD_LEAF.map((a) => (
                      <button key={a.type} type="button" onClick={() => addTo(node.id, a.type)} className="rounded border border-border px-1.5 py-0.5 text-[11px]">+ {a.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* 콘텐츠 속성 */}
              <ContentProps node={node} readOnly={readOnly} onSet={setProp} />

              {/* 레이아웃/스타일 (device 레이어) */}
              <StylePanel
                node={node}
                isContainer={isContainer}
                device={device}
                readOnly={readOnly}
                tokenKeys={Object.keys(doc.tokens.colors)}
                sval={sval}
                overridden={overridden}
                onSet={setStyle}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LayerNode({
  doc,
  id,
  depth,
  sel,
  onSelect,
}: {
  doc: DesignDocument;
  id: NodeId;
  depth: number;
  sel: NodeId | null;
  onSelect: (id: NodeId) => void;
}) {
  const n = doc.nodes[id];
  if (!n) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(id)}
        style={{ paddingLeft: 6 + depth * 12 }}
        className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-xs ${sel === id ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-muted"}`}
      >
        {n.locked && <span>🔒</span>}
        {TYPE_KO[n.type] ?? n.type}
      </button>
      {(n.children ?? []).map((c) => (
        <LayerNode key={c} doc={doc} id={c} depth={depth + 1} sel={sel} onSelect={onSelect} />
      ))}
    </div>
  );
}

const inputCls =
  "w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary";

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

function ContentProps({
  node,
  readOnly,
  onSet,
}: {
  node: DocNode;
  readOnly: boolean;
  onSet: (p: Record<string, unknown>) => void;
}) {
  const p = node.props ?? {};
  const d = readOnly;
  if (node.type === "heading")
    return (
      <div className="space-y-2">
        <Field label="레벨">
          <select disabled={d} value={Number(p.level ?? 2)} onChange={(e) => onSet({ level: Number(e.target.value) })} className={inputCls}>
            {[1, 2, 3, 4].map((l) => (<option key={l} value={l}>H{l}</option>))}
          </select>
        </Field>
        <Field label="텍스트"><input disabled={d} value={String(p.text ?? "")} onChange={(e) => onSet({ text: e.target.value })} className={inputCls} /></Field>
      </div>
    );
  if (node.type === "text")
    return <Field label="내용"><textarea disabled={d} value={String(p.html ?? "")} onChange={(e) => onSet({ html: e.target.value })} rows={4} className={inputCls} /></Field>;
  if (node.type === "button")
    return (
      <div className="space-y-2">
        <Field label="문구"><input disabled={d} value={String(p.label ?? "")} onChange={(e) => onSet({ label: e.target.value })} className={inputCls} /></Field>
        <Field label="링크(선택)"><input disabled={d} value={String(p.href ?? "")} onChange={(e) => onSet({ href: e.target.value })} className={inputCls} placeholder="https:// / #contact / tel:" /></Field>
        <Field label="스타일">
          <select disabled={d} value={String(p.variant ?? "primary")} onChange={(e) => onSet({ variant: e.target.value })} className={inputCls}>
            <option value="primary">강조</option><option value="outline">외곽선</option><option value="ghost">연하게</option>
          </select>
        </Field>
      </div>
    );
  if (node.type === "image")
    return (
      <div className="space-y-2">
        <Field label="이미지 주소"><input disabled={d} value={String(p.src ?? "")} onChange={(e) => onSet({ src: e.target.value })} className={inputCls} placeholder="https:// 또는 /" /></Field>
        <Field label="대체 텍스트"><input disabled={d} value={String(p.alt ?? "")} onChange={(e) => onSet({ alt: e.target.value })} className={inputCls} /></Field>
      </div>
    );
  if (node.type === "card")
    return (
      <div className="space-y-2">
        <Field label="제목"><input disabled={d} value={String(p.title ?? "")} onChange={(e) => onSet({ title: e.target.value })} className={inputCls} /></Field>
        <Field label="설명"><textarea disabled={d} value={String(p.body ?? "")} onChange={(e) => onSet({ body: e.target.value })} rows={3} className={inputCls} /></Field>
      </div>
    );
  if (node.type === "list")
    return <Field label="항목(줄마다)"><textarea disabled={d} value={(Array.isArray(p.items) ? (p.items as string[]) : []).join("\n")} onChange={(e) => onSet({ items: e.target.value.split("\n") })} rows={4} className={inputCls} /></Field>;
  if (node.type === "spacer")
    return <Field label="크기"><input type="number" disabled={d} value={Number(p.size ?? 4)} onChange={(e) => onSet({ size: Math.max(0, Number(e.target.value)) })} className={inputCls} /></Field>;
  return null;
}

function StylePanel({
  node,
  isContainer,
  device,
  readOnly,
  tokenKeys,
  sval,
  overridden,
  onSet,
}: {
  node: DocNode;
  isContainer: boolean;
  device: Device;
  readOnly: boolean;
  tokenKeys: string[];
  sval: <K extends keyof StyleProps>(k: K) => StyleProps[K] | undefined;
  overridden: (k: keyof StyleProps) => boolean;
  onSet: (p: Partial<StyleProps>) => void;
}) {
  const d = readOnly;
  const reset = (k: keyof StyleProps) => onSet({ [k]: null } as unknown as Partial<StyleProps>);
  const ovTag = (k: keyof StyleProps) =>
    device !== "base" && overridden(k) ? (
      <button type="button" onClick={() => reset(k)} className="ml-1 text-[10px] text-primary">초기화</button>
    ) : null;
  const num = (k: keyof StyleProps, label: string, min = 0, max = 2000) => (
    <Field label={<>{label}{ovTag(k)}</>}>
      <input type="number" disabled={d} value={Number(sval(k) ?? "")} min={min} max={max}
        onChange={(e) => onSet({ [k]: e.target.value === "" ? null : Number(e.target.value) } as Partial<StyleProps>)} className={inputCls} />
    </Field>
  );
  const display = sval("display");
  return (
    <div className="space-y-2 rounded-lg border border-border p-2">
      <p className="text-[11px] font-semibold text-foreground">레이아웃 / 스타일</p>
      {isContainer && (
        <>
          <Field label={<>배치{ovTag("display")}</>}>
            <select disabled={d} value={String(display ?? "block")} onChange={(e) => onSet({ display: e.target.value as StyleProps["display"] })} className={inputCls}>
              <option value="block">세로 흐름</option><option value="flex">Flex</option><option value="grid">Grid</option>
            </select>
          </Field>
          {display === "flex" && (
            <>
              <Field label={<>방향{ovTag("direction")}</>}>
                <select disabled={d} value={String(sval("direction") ?? "row")} onChange={(e) => onSet({ direction: e.target.value as StyleProps["direction"] })} className={inputCls}>
                  <option value="row">가로</option><option value="column">세로</option>
                </select>
              </Field>
              <Field label={<>정렬(주축){ovTag("justify")}</>}>
                <select disabled={d} value={String(sval("justify") ?? "start")} onChange={(e) => onSet({ justify: e.target.value as StyleProps["justify"] })} className={inputCls}>
                  <option value="start">시작</option><option value="center">가운데</option><option value="end">끝</option><option value="between">양끝</option><option value="around">균등</option>
                </select>
              </Field>
              <Field label={<>정렬(교차){ovTag("align")}</>}>
                <select disabled={d} value={String(sval("align") ?? "stretch")} onChange={(e) => onSet({ align: e.target.value as StyleProps["align"] })} className={inputCls}>
                  <option value="start">시작</option><option value="center">가운데</option><option value="end">끝</option><option value="stretch">늘이기</option>
                </select>
              </Field>
            </>
          )}
          {display === "grid" && num("gridColumns", "열 수", 1, 12)}
          {num("gap", "간격", 0, 16)}
        </>
      )}
      {num("colSpan", "열 차지(1~12)", 1, 12)}
      <Field label={<>폭{ovTag("widthMode")}</>}>
        <select disabled={d} value={String(sval("widthMode") ?? "auto")} onChange={(e) => onSet({ widthMode: e.target.value as StyleProps["widthMode"] })} className={inputCls}>
          <option value="auto">자동</option><option value="fill">가득</option><option value="fixed">고정(px)</option>
        </select>
      </Field>
      {sval("widthMode") === "fixed" && num("width", "폭(px)", 0, 4000)}
      {num("maxWidth", "최대 폭(px)", 0, 4000)}
      {num("paddingX", "좌우 여백", 0, 16)}
      {num("paddingY", "상하 여백", 0, 16)}
      {num("radius", "모서리 라운드(px)", 0, 48)}
      <Field label={<>배경{ovTag("background")}</>}>
        <select disabled={d} value={String(sval("background") ?? "")} onChange={(e) => onSet({ background: e.target.value || null } as Partial<StyleProps>)} className={inputCls}>
          <option value="">없음</option><option value="transparent">투명</option>
          {tokenKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
        </select>
      </Field>
      {(node.type === "heading" || node.type === "text") && (
        <>
          {num("fontSize", "글자 크기(px)", 8, 120)}
          <Field label={<>글자 정렬{ovTag("align_text")}</>}>
            <select disabled={d} value={String(sval("align_text") ?? "left")} onChange={(e) => onSet({ align_text: e.target.value as StyleProps["align_text"] })} className={inputCls}>
              <option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option>
            </select>
          </Field>
          <Field label={<>글자색{ovTag("color")}</>}>
            <select disabled={d} value={String(sval("color") ?? "")} onChange={(e) => onSet({ color: e.target.value || null } as Partial<StyleProps>)} className={inputCls}>
              <option value="">기본</option>
              {tokenKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
            </select>
          </Field>
        </>
      )}
    </div>
  );
}
