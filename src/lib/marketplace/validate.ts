import { sanitizeInlineHtml } from "@/utils/richtext";
import { SCHEMA_LIMITS } from "./config";
import {
  ALLOWED_COMPONENT_TYPES,
  type Column,
  type ComponentNode,
  type ComponentType,
  type DesignTokens,
  type PageSchema,
  type Row,
  type Section,
} from "./pageSchema";

/**
 * Page Schema 서버 검증 — '자유로운 디자인, 안전한 실행'의 핵심.
 * 허용 컴포넌트/토큰/한도만 통과시키고, 텍스트는 새니타이즈, 링크·이미지는
 * 안전한 스킴만 허용한다. 임의 HTML/스크립트/CSS 주입을 차단한다.
 */

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** 통과 시 새니타이즈·정규화된 스키마. */
  schema?: PageSchema;
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;

function isLiteralColor(v: string): boolean {
  return v === "transparent" || HEX.test(v) || RGB.test(v);
}

/** 색상 참조 — 토큰 키이거나 리터럴 색상만 허용. */
function isColorRef(v: string | undefined, tokens: DesignTokens): boolean {
  if (v == null) return true;
  if (Object.prototype.hasOwnProperty.call(tokens.colors, v)) return true;
  return isLiteralColor(v);
}

/** 링크 — http(s)/상대경로/메일/전화만. javascript:·data: 등 차단. */
export function isSafeHref(href: string): boolean {
  const h = href.trim();
  if (!h) return false;
  if (/[\u0000-\u001f]/.test(h)) return false;
  return /^(https?:\/\/|\/|mailto:|tel:)/i.test(h);
}

/** 이미지 — https 또는 상대경로만. data:·javascript: 차단. */
export function isSafeImageSrc(src: string): boolean {
  const s = src.trim();
  if (!s) return false;
  if (/[\u0000-\u001f]/.test(s)) return false;
  return /^(https:\/\/|\/)/i.test(s);
}

function validateComponent(
  comp: unknown,
  tokens: DesignTokens,
  path: string,
  errors: string[],
): ComponentNode | null {
  if (!comp || typeof comp !== "object") {
    errors.push(`${path}: 컴포넌트 형식 오류`);
    return null;
  }
  const type = (comp as { type?: unknown }).type;
  if (typeof type !== "string" || !ALLOWED_COMPONENT_TYPES.includes(type as ComponentType)) {
    errors.push(`${path}: 허용되지 않은 컴포넌트 "${String(type)}"`);
    return null;
  }
  const node = comp as ComponentNode;
  switch (node.type) {
    case "heading": {
      if (![1, 2, 3, 4].includes(node.level)) errors.push(`${path}: heading level 오류`);
      if (!isColorRef(node.color, tokens)) errors.push(`${path}: heading 색상 오류`);
      const text = String(node.text ?? "").slice(0, SCHEMA_LIMITS.maxTextLength);
      return { ...node, text: sanitizeInlineHtml(text) };
    }
    case "text": {
      const raw = String(node.html ?? "").slice(0, SCHEMA_LIMITS.maxTextLength);
      return { ...node, html: sanitizeInlineHtml(raw) };
    }
    case "image": {
      if (!isSafeImageSrc(String(node.src ?? "")))
        errors.push(`${path}: 안전하지 않은 이미지 주소`);
      return { ...node, alt: String(node.alt ?? "").slice(0, 300) };
    }
    case "button": {
      if (node.href != null && !isSafeHref(node.href))
        errors.push(`${path}: 안전하지 않은 링크`);
      return { ...node, label: String(node.label ?? "").slice(0, 200) };
    }
    case "list": {
      const items = Array.isArray(node.items)
        ? node.items.slice(0, 50).map((i) => sanitizeInlineHtml(String(i).slice(0, 2000)))
        : [];
      return { ...node, items };
    }
    case "card": {
      if (node.image != null && !isSafeImageSrc(String(node.image)))
        errors.push(`${path}: 카드 이미지 주소 오류`);
      return {
        ...node,
        title: node.title ? sanitizeInlineHtml(String(node.title).slice(0, 300)) : undefined,
        body: node.body ? sanitizeInlineHtml(String(node.body).slice(0, 4000)) : undefined,
      };
    }
    case "spacer":
    case "divider":
      return node;
    default:
      errors.push(`${path}: 알 수 없는 컴포넌트`);
      return null;
  }
}

function validateColumn(col: Column, tokens: DesignTokens, path: string, errors: string[]): Column {
  const span = Number.isFinite(col?.span)
    ? Math.min(SCHEMA_LIMITS.gridSpan, Math.max(1, Math.round(col.span)))
    : SCHEMA_LIMITS.gridSpan;
  if (!isColorRef(col?.layout?.background, tokens))
    errors.push(`${path}: 컬럼 배경색 오류`);
  const comps = Array.isArray(col?.components) ? col.components : [];
  if (comps.length > SCHEMA_LIMITS.maxComponentsPerColumn)
    errors.push(`${path}: 컬럼 컴포넌트 과다`);
  const validated = comps
    .slice(0, SCHEMA_LIMITS.maxComponentsPerColumn)
    .map((c, i) => validateComponent(c, tokens, `${path}.component[${i}]`, errors))
    .filter((c): c is ComponentNode => c !== null);
  return { span, components: validated, layout: col.layout };
}

function validateRow(row: Row, tokens: DesignTokens, path: string, errors: string[]): Row {
  const cols = Array.isArray(row?.columns) ? row.columns : [];
  if (cols.length > SCHEMA_LIMITS.maxColumnsPerRow)
    errors.push(`${path}: 컬럼 수 초과`);
  if (!isColorRef(row?.layout?.background, tokens)) errors.push(`${path}: 행 배경색 오류`);
  return {
    columns: cols
      .slice(0, SCHEMA_LIMITS.maxColumnsPerRow)
      .map((c, i) => validateColumn(c, tokens, `${path}.col[${i}]`, errors)),
    layout: row.layout,
  };
}

function validateSection(s: Section, tokens: DesignTokens, idx: number, errors: string[]): Section {
  const path = `section[${idx}]`;
  const id = typeof s?.id === "string" && s.id ? s.id : `s${idx}`;
  const rows = Array.isArray(s?.rows) ? s.rows : [];
  if (rows.length > SCHEMA_LIMITS.maxRowsPerSection) errors.push(`${path}: 행 수 초과`);
  if (!isColorRef(s?.layout?.base?.background, tokens))
    errors.push(`${path}: 섹션 배경색 오류`);
  return {
    id,
    rows: rows
      .slice(0, SCHEMA_LIMITS.maxRowsPerSection)
      .map((r, i) => validateRow(r, tokens, `${path}.row[${i}]`, errors)),
    layout: s.layout,
  };
}

function validateTokens(t: DesignTokens, errors: string[]): DesignTokens {
  const colors: Record<string, string> = {};
  const src = t && typeof t === "object" && t.colors ? t.colors : {};
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === "string" && isLiteralColor(v)) colors[k] = v;
    else errors.push(`tokens.colors.${k}: 색상값 오류`);
  }
  if (Object.keys(colors).length === 0) {
    colors.primary = "#4f46e5";
    colors.bg = "#ffffff";
    colors.text = "#111827";
  }
  return {
    colors,
    fontFamily: typeof t?.fontFamily === "string" ? t.fontFamily.slice(0, 40) : undefined,
    radius: Number.isFinite(t?.radius) ? Math.min(48, Math.max(0, Number(t!.radius))) : undefined,
    spacingUnit: Number.isFinite(t?.spacingUnit)
      ? Math.min(16, Math.max(2, Number(t!.spacingUnit)))
      : undefined,
  };
}

/** Page Schema 전체 검증. ok=false면 schema는 없고 errors에 사유. */
export function validatePageSchema(input: unknown): ValidationResult {
  const errors: string[] = [];
  const raw = input as Partial<PageSchema> | null;
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["스키마가 비어 있습니다."] };
  }
  if (raw.version !== 1) errors.push("지원하지 않는 스키마 버전입니다.");
  const tokens = validateTokens(raw.tokens as DesignTokens, errors);
  const sectionsIn = Array.isArray(raw.sections) ? raw.sections : [];
  if (sectionsIn.length > SCHEMA_LIMITS.maxSections) errors.push("섹션 수 초과");
  const sections = sectionsIn
    .slice(0, SCHEMA_LIMITS.maxSections)
    .map((s, i) => validateSection(s as Section, tokens, i, errors));

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], schema: { version: 1, tokens, sections } };
}
