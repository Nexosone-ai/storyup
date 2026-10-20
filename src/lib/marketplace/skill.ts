import { validatePageSchema, type ValidationResult } from "./validate";
import {
  type ComponentNode,
  type ContentSlot,
  type DesignTokens,
  type PageSchema,
} from "./pageSchema";

/**
 * Skill = 재사용 가능한 제작 패키지(디자인 지침·토큰·페이지 구조·샘플·검증 규칙).
 * 외부 프로그램 실행 권한이 아니다. Skill 안의 지시/값은 '신뢰하지 않는 입력'으로 다루고,
 * 산출 Page Schema는 반드시 validatePageSchema를 통과해야 한다(허용 컴포넌트·토큰만).
 *
 * 1단계: 레지스트리 타입 + 검증 + '결정적 인스턴스화'(슬롯에 콘텐츠 주입)만 제공.
 * AI 생성/수정은 2단계에서 이 위에 얹는다.
 */

export interface SkillManifest {
  /** 식별자(소유자 범위 내 유니크). */
  key: string;
  version: string;
  author: string;
  /** 호환 Page Schema 버전. */
  compatSchema: 1;
  languages: string[]; // 예: ["ko","en"]
  /** 이 Skill이 사용하는 허용 컴포넌트 타입(플랫폼 허용목록의 부분집합). */
  allowedComponents: ComponentNode["type"][];
  industry?: string;
  tone?: string;
}

export interface SkillPackage {
  manifest: SkillManifest;
  tokens: DesignTokens;
  /** 편집 가능 페이지 구조(슬롯 포함). */
  pageSchema: PageSchema;
  /** 노출 콘텐츠 슬롯 정의. */
  slots: ContentSlot[];
  /** 가상 사업장 예시 콘텐츠(slot.key → 값). 프리뷰/미입력 폴백. */
  sampleContent: Record<string, string>;
  /** 필수 필드·금지 속성 등 추가 검증 규칙(1단계는 requiredSlots만). */
  checks?: { requiredSlots?: string[] };
}

/** Skill 패키지 자체 검증 — manifest·pageSchema·슬롯 정합성. */
export function validateSkillPackage(pkg: unknown): ValidationResult {
  const errors: string[] = [];
  const p = pkg as Partial<SkillPackage> | null;
  if (!p || typeof p !== "object") return { ok: false, errors: ["Skill 패키지가 비어 있습니다."] };

  const m = p.manifest;
  if (!m || typeof m.key !== "string" || !m.key) errors.push("manifest.key 누락");
  if (m && m.compatSchema !== 1) errors.push("호환 스키마 버전이 아닙니다.");
  if (m && !Array.isArray(m.allowedComponents)) errors.push("manifest.allowedComponents 오류");

  // 핵심: 페이지 스키마는 플랫폼 검증기를 반드시 통과.
  const schemaResult = validatePageSchema(p.pageSchema);
  if (!schemaResult.ok) errors.push(...schemaResult.errors.map((e) => `pageSchema: ${e}`));

  // 슬롯 정의 정합성.
  const slotKeys = new Set((p.slots ?? []).map((s) => s?.key).filter(Boolean));
  for (const req of p.checks?.requiredSlots ?? []) {
    if (!slotKeys.has(req)) errors.push(`필수 슬롯 정의 누락: ${req}`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], schema: schemaResult.schema };
}

/** 컴포넌트에 슬롯 값을 주입(타입별 주요 필드). */
function applySlot(node: ComponentNode, value: string): ComponentNode {
  switch (node.type) {
    case "heading":
      return { ...node, text: value };
    case "text":
      return { ...node, html: value };
    case "image":
      return { ...node, src: value };
    case "button":
      return { ...node, label: value };
    case "card":
      return { ...node, body: value };
    default:
      return node;
  }
}

/**
 * 결정적 인스턴스화 — Skill의 pageSchema 슬롯에 콘텐츠를 주입해 Page Schema를 만든다.
 * content[slot] 우선, 없으면 sampleContent[slot] 폴백. 결과는 반드시 재검증한다.
 */
export function instantiateSkill(
  pkg: SkillPackage,
  content: Record<string, string> = {},
): ValidationResult {
  const resolve = (slot?: string): string | null => {
    if (!slot) return null;
    if (content[slot] != null) return String(content[slot]);
    if (pkg.sampleContent?.[slot] != null) return String(pkg.sampleContent[slot]);
    return null;
  };

  const sections = pkg.pageSchema.sections.map((s) => ({
    ...s,
    rows: s.rows.map((r) => ({
      ...r,
      columns: r.columns.map((c) => ({
        ...c,
        components: c.components.map((comp) => {
          const slot = (comp as { slot?: string }).slot;
          const value = resolve(slot);
          return value != null ? applySlot(comp, value) : comp;
        }),
      })),
    })),
  }));

  // 주입 후에도 플랫폼 검증을 통과해야 한다(새니타이즈·안전성 재확인).
  return validatePageSchema({
    version: 1,
    tokens: pkg.tokens,
    sections,
  });
}
