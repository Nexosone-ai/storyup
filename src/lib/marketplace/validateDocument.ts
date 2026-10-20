import { sanitizeInlineHtml } from "@/utils/richtext";
import type { DesignTokens } from "./pageSchema";
import {
  CONTAINER_TYPES,
  LEAF_TYPES,
  type DesignDocument,
  type DocNode,
  type NodeId,
  type NodeType,
  type StyleProps,
} from "./document";

/**
 * V2 문서 검증 — '자유로운 디자인, 안전한 실행'의 핵심.
 * 안정 id·순환·중첩 규칙·허용 노드/스타일/토큰만 통과, 콘텐츠 새니타이즈,
 * 안전 href/img만. 임의 HTML/스크립트/CSS는 차단. 결과는 정규화된 문서.
 */

export const DOC_LIMITS = {
  maxNodes: 600,
  maxDepth: 12,
  maxChildren: 50,
  maxText: 8000,
  grid: 12,
} as const;

export interface DocValidation {
  ok: boolean;
  errors: string[];
  doc?: DesignDocument;
}

const HEX = /^#([0-9a-fA-F]{3,8})$/;
const RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
const ALL_TYPES: NodeType[] = [...CONTAINER_TYPES, ...LEAF_TYPES];

function isColor(v: string | undefined, tokens: DesignTokens): boolean {
  if (v == null) return true;
  if (v === "transparent") return true;
  if (Object.prototype.hasOwnProperty.call(tokens.colors, v)) return true;
  return HEX.test(v) || RGB.test(v);
}

export function isSafeHref(href: string): boolean {
  const h = href.trim();
  if (!h || /[\u0000-\u001f]/.test(h)) return false;
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(h);
}
export function isSafeImg(src: string): boolean {
  const s = src.trim();
  if (!s || /[\u0000-\u001f]/.test(s)) return false;
  return /^(https:\/\/|\/)/i.test(s);
}

const num = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;

const ENUM = <T extends string>(v: unknown, vals: readonly T[]): T | undefined =>
  typeof v === "string" && (vals as readonly string[]).includes(v) ? (v as T) : undefined;

/** 스타일 한 겹(base 또는 오버라이드)을 정규화 — 허용값만 남긴다. */
function cleanStyle(s: Partial<StyleProps> | undefined, tokens: DesignTokens, errors: string[], path: string): Partial<StyleProps> {
  const o: Partial<StyleProps> = {};
  if (!s || typeof s !== "object") return o;
  o.display = ENUM(s.display, ["block", "flex", "grid"] as const);
  o.direction = ENUM(s.direction, ["row", "column"] as const);
  o.justify = ENUM(s.justify, ["start", "center", "end", "between", "around"] as const);
  o.align = ENUM(s.align, ["start", "center", "end", "stretch"] as const);
  if (typeof s.wrap === "boolean") o.wrap = s.wrap;
  o.gap = num(s.gap, 0, 16) as StyleProps["gap"];
  o.grow = ENUM(String(s.grow), ["0", "1"] as const) ? ((s.grow === 1 ? 1 : 0) as 0 | 1) : undefined;
  o.gridColumns = num(s.gridColumns, 1, DOC_LIMITS.grid);
  o.colSpan = num(s.colSpan, 1, DOC_LIMITS.grid);
  o.widthMode = ENUM(s.widthMode, ["auto", "fill", "fixed"] as const);
  o.width = num(s.width, 0, 4000);
  o.maxWidth = num(s.maxWidth, 0, 4000);
  o.minWidth = num(s.minWidth, 0, 4000);
  o.paddingX = num(s.paddingX, 0, 16) as StyleProps["paddingX"];
  o.paddingY = num(s.paddingY, 0, 16) as StyleProps["paddingY"];
  o.marginY = num(s.marginY, 0, 16) as StyleProps["marginY"];
  if (s.background != null) {
    if (isColor(s.background, tokens)) o.background = s.background;
    else errors.push(`${path}: 배경색 오류`);
  }
  o.radius = num(s.radius, 0, 48);
  o.shadow = ENUM(s.shadow, ["none", "sm", "md", "lg"] as const);
  o.fontSize = num(s.fontSize, 8, 120);
  if (s.fontWeight && [400, 500, 600, 700, 800].includes(s.fontWeight)) o.fontWeight = s.fontWeight;
  o.lineHeight = num(s.lineHeight, 1, 3);
  o.align_text = ENUM(s.align_text, ["left", "center", "right"] as const);
  if (s.color != null) {
    if (isColor(s.color, tokens)) o.color = s.color;
    else errors.push(`${path}: 색상 오류`);
  }
  // undefined 키 제거
  (Object.keys(o) as (keyof StyleProps)[]).forEach((k) => o[k] === undefined && delete o[k]);
  return o;
}

function cleanProps(node: DocNode, errors: string[], path: string): Record<string, unknown> {
  const p = (node.props ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  switch (node.type) {
    case "heading":
      out.level = num(p.level, 1, 4) ?? 2;
      out.text = sanitizeInlineHtml(String(p.text ?? "").slice(0, DOC_LIMITS.maxText));
      break;
    case "text":
      out.html = sanitizeInlineHtml(String(p.html ?? "").slice(0, DOC_LIMITS.maxText));
      break;
    case "image":
      if (!isSafeImg(String(p.src ?? ""))) errors.push(`${path}: 이미지 주소 오류`);
      else out.src = String(p.src);
      out.alt = String(p.alt ?? "").slice(0, 300);
      out.ratio = ENUM(p.ratio, ["16:9", "4:3", "1:1", "3:4"] as const);
      break;
    case "button":
      out.label = String(p.label ?? "버튼").slice(0, 200);
      if (p.href != null) {
        if (isSafeHref(String(p.href))) out.href = String(p.href);
        else errors.push(`${path}: 링크 오류`);
      }
      out.variant = ENUM(p.variant, ["primary", "outline", "ghost"] as const);
      break;
    case "list":
      out.ordered = !!p.ordered;
      out.items = Array.isArray(p.items)
        ? p.items.slice(0, 50).map((i) => sanitizeInlineHtml(String(i).slice(0, 2000)))
        : [];
      break;
    case "card":
      out.title = p.title ? sanitizeInlineHtml(String(p.title).slice(0, 300)) : undefined;
      out.body = p.body ? sanitizeInlineHtml(String(p.body).slice(0, 4000)) : undefined;
      if (p.image != null && !isSafeImg(String(p.image))) errors.push(`${path}: 카드 이미지 오류`);
      else if (p.image) out.image = String(p.image);
      break;
    case "spacer":
      out.size = num(p.size, 0, 16) ?? 4;
      break;
    default:
      break;
  }
  return out;
}

export function validateDocument(input: unknown): DocValidation {
  const errors: string[] = [];
  const raw = input as Partial<DesignDocument> | null;
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["문서가 비어 있습니다."] };
  if (raw.version !== 2) errors.push("지원하지 않는 문서 버전입니다.");

  // 토큰
  const tokens: DesignTokens = { colors: {} };
  const srcColors = raw.tokens?.colors && typeof raw.tokens.colors === "object" ? raw.tokens.colors : {};
  for (const [k, v] of Object.entries(srcColors)) {
    if (typeof v === "string" && (HEX.test(v) || RGB.test(v) || v === "transparent")) tokens.colors[k] = v;
    else errors.push(`tokens.colors.${k}: 색상값 오류`);
  }
  if (Object.keys(tokens.colors).length === 0) {
    tokens.colors = { primary: "#4f46e5", bg: "#ffffff", text: "#111827" };
  }
  if (typeof raw.tokens?.fontFamily === "string") tokens.fontFamily = raw.tokens.fontFamily.slice(0, 40);
  if (Number.isFinite(raw.tokens?.radius)) tokens.radius = Math.min(48, Math.max(0, Number(raw.tokens!.radius)));
  if (Number.isFinite(raw.tokens?.spacingUnit)) tokens.spacingUnit = Math.min(16, Math.max(2, Number(raw.tokens!.spacingUnit)));

  const nodesIn = raw.nodes && typeof raw.nodes === "object" ? raw.nodes : {};
  const rootId = typeof raw.root === "string" ? raw.root : "";
  if (!rootId || !nodesIn[rootId]) errors.push("루트 노드가 없습니다.");
  else if (nodesIn[rootId].type !== "page") errors.push("루트는 page 노드여야 합니다.");

  const ids = Object.keys(nodesIn);
  if (ids.length > DOC_LIMITS.maxNodes) errors.push("노드 수 초과");

  // 노드 정규화
  const nodes: Record<NodeId, DocNode> = {};
  for (const id of ids) {
    const n = nodesIn[id] as DocNode;
    if (!n || n.id !== id || !ALL_TYPES.includes(n.type)) {
      errors.push(`node ${id}: 형식/타입 오류`);
      continue;
    }
    const isContainer = CONTAINER_TYPES.includes(n.type);
    const childIds = Array.isArray(n.children) ? n.children.filter((c) => typeof c === "string") : [];
    if (!isContainer && childIds.length > 0) errors.push(`node ${id}: 잎 노드는 자식을 가질 수 없어요`);
    if (childIds.length > DOC_LIMITS.maxChildren) errors.push(`node ${id}: 자식 수 초과`);
    for (const c of childIds) if (!nodesIn[c]) errors.push(`node ${id}: 없는 자식 참조(${c})`);

    const style = {
      base: cleanStyle(n.style?.base, tokens, errors, `node ${id}.base`),
      mobile: cleanStyle(n.style?.mobile, tokens, errors, `node ${id}.mobile`),
      tablet: cleanStyle(n.style?.tablet, tokens, errors, `node ${id}.tablet`),
      desktop: cleanStyle(n.style?.desktop, tokens, errors, `node ${id}.desktop`),
    };
    nodes[id] = {
      id,
      type: n.type,
      props: cleanProps(n, errors, `node ${id}`),
      style,
      children: isContainer ? childIds : undefined,
      locked: n.locked === true || undefined,
      slot: typeof n.slot === "string" ? n.slot.slice(0, 60) : undefined,
      componentRef: typeof n.componentRef === "string" ? n.componentRef : undefined,
    };
  }

  // 순환 검출 + 깊이(루트에서 DFS)
  if (rootId && nodes[rootId]) {
    const seen = new Set<NodeId>();
    const stack: { id: NodeId; depth: number }[] = [{ id: rootId, depth: 1 }];
    const inPath = new Set<NodeId>();
    const dfs = (id: NodeId, depth: number, path: Set<NodeId>): void => {
      if (path.has(id)) {
        errors.push(`순환 참조: ${id}`);
        return;
      }
      if (depth > DOC_LIMITS.maxDepth) {
        errors.push("중첩 깊이 초과");
        return;
      }
      seen.add(id);
      path.add(id);
      for (const c of nodes[id]?.children ?? []) if (nodes[c]) dfs(c, depth + 1, path);
      path.delete(id);
    };
    dfs(rootId, 1, inPath);
    void stack;
    // 루트에서 도달 못하는 고아 노드 제거
    for (const id of Object.keys(nodes)) if (!seen.has(id) && id !== rootId) delete nodes[id];
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    doc: { version: 2, tokens, root: rootId, nodes, revision: Number.isFinite(raw.revision) ? Number(raw.revision) : 1 },
  };
}
