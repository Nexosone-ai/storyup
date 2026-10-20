import type { DesignTokens, SpaceToken } from "./pageSchema";

/**
 * V2 전문 편집 문서 모델 — 진실의 원천(단일 문서 트리).
 * Document → Page(root) → Section → Container → Component(leaf)의 중첩 트리를
 * '평면 노드맵 + children id 배열'로 표현한다(안정 id·id 기반 Patch·순환 검출 용이).
 * 편집 캔버스·레이어·속성·AI Patch·공개 렌더러가 모두 이 모델만 사용한다.
 * 임의 HTML/코드가 아니라 검증된 노드·토큰만 담는다(안전 실행).
 */

export type NodeId = string;

export type NodeType =
  | "page"
  | "section"
  | "container"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "list"
  | "card"
  | "spacer"
  | "divider"
  | "instance";

/** 자식을 가질 수 있는 노드(레이아웃 컨테이너). */
export const CONTAINER_TYPES: NodeType[] = ["page", "section", "container"];
/** 잎(콘텐츠) 노드. */
export const LEAF_TYPES: NodeType[] = [
  "heading",
  "text",
  "image",
  "button",
  "list",
  "card",
  "spacer",
  "divider",
];

export type AlignX = "start" | "center" | "end" | "stretch";
export type JustifyX = "start" | "center" | "end" | "between" | "around";
export type SizeMode = "auto" | "fill" | "fixed";

/** 노드 스타일 — CSS 직접값이 아니라 토큰/열거/수치(검증됨)만. */
export interface StyleProps {
  /** 레이아웃 방식. */
  display?: "block" | "flex" | "grid";
  // flex
  direction?: "row" | "column";
  justify?: JustifyX;
  align?: AlignX;
  wrap?: boolean;
  gap?: SpaceToken;
  grow?: 0 | 1;
  // grid
  gridColumns?: number; // 1~12
  colSpan?: number; // 1~12
  // 크기
  widthMode?: SizeMode;
  width?: number; // widthMode=fixed일 때 px
  maxWidth?: number;
  minWidth?: number;
  // 박스
  paddingX?: SpaceToken;
  paddingY?: SpaceToken;
  marginY?: SpaceToken;
  background?: string; // 토큰 키 | 색 리터럴 | "transparent"
  radius?: number;
  shadow?: "none" | "sm" | "md" | "lg";
  // 타이포(텍스트 계열)
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700 | 800;
  lineHeight?: number;
  align_text?: "left" | "center" | "right";
  color?: string; // 토큰 키 | 색 리터럴
}

export interface Responsive<T> {
  base: T;
  mobile?: Partial<T>;
  tablet?: Partial<T>;
  desktop?: Partial<T>;
}

export interface DocNode {
  id: NodeId;
  type: NodeType;
  /** 콘텐츠 속성(text/src/label/items/level 등) — 타입별. */
  props?: Record<string, unknown>;
  /** 스타일(반응형 오버라이드 포함). */
  style?: Responsive<StyleProps>;
  /** 컨테이너 노드의 자식 id 순서. */
  children?: NodeId[];
  /** 잠금 — Skill/AI가 변경하지 못한다(사용자 규칙 우선). */
  locked?: boolean;
  /** type='instance'일 때 참조하는 컴포넌트 정의 id. */
  componentRef?: string;
  /** 인스턴스별 콘텐츠 오버라이드: 슬롯키 → props 패치(연결 인스턴스). */
  overrides?: Record<string, Record<string, unknown>>;
  /** 콘텐츠 슬롯 키(판매 템플릿·인스턴스 오버라이드의 편집 가능 필드). */
  slot?: string;
}

/** 재사용 컴포넌트 정의 — 자기완결 서브트리(인스턴스가 참조해 '연결'됨). */
export interface ComponentDef {
  id: string;
  name: string;
  root: NodeId;
  nodes: Record<NodeId, DocNode>;
}

export interface DesignDocument {
  version: 2;
  tokens: DesignTokens;
  /** 페이지 루트 노드 id. */
  root: NodeId;
  /** 평면 노드맵(안정 id). */
  nodes: Record<NodeId, DocNode>;
  /** 재사용 컴포넌트 정의(연결 인스턴스의 원본). */
  components?: Record<string, ComponentDef>;
  /** 낙관적 동시편집·Patch 기준용 revision. */
  revision: number;
}

let _n = 0;
/** 안정적이고 짧은 노드 id 생성. */
export function newId(prefix = "n"): NodeId {
  _n += 1;
  return `${prefix}_${Date.now().toString(36)}_${_n.toString(36)}`;
}

/** 빈 문서(빈 페이지 루트). */
export function emptyDocument(): DesignDocument {
  const root = newId("page");
  return {
    version: 2,
    tokens: { colors: { primary: "#4f46e5", bg: "#ffffff", text: "#111827" } },
    root,
    nodes: {
      [root]: { id: root, type: "page", children: [], style: { base: {} } },
    },
    revision: 1,
  };
}

export const childrenOf = (doc: DesignDocument, id: NodeId): DocNode[] =>
  (doc.nodes[id]?.children ?? [])
    .map((cid) => doc.nodes[cid])
    .filter((n): n is DocNode => !!n);

/** 노드의 부모 id(없으면 null). 평면맵 역탐색. */
export function parentOf(doc: DesignDocument, id: NodeId): NodeId | null {
  for (const n of Object.values(doc.nodes)) {
    if (n.children?.includes(id)) return n.id;
  }
  return null;
}

/** 루트→노드 경로(브레드크럼용). */
export function pathTo(doc: DesignDocument, id: NodeId): NodeId[] {
  const path: NodeId[] = [];
  let cur: NodeId | null = id;
  const guard = new Set<NodeId>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    path.unshift(cur);
    cur = parentOf(doc, cur);
  }
  return path;
}
