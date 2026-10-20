import {
  CONTAINER_TYPES,
  newId,
  type DesignDocument,
  type DocNode,
  type NodeId,
  type NodeType,
  type StyleProps,
  type Responsive,
} from "./document";

/**
 * 문서 조작 순수 함수 — 모두 새 문서(불변)를 반환하고 revision을 올린다.
 * 에디터·AI Patch가 공용으로 사용. 부분 변경이 남지 않도록 각 연산은 완결적.
 */

export const cloneDoc = (d: DesignDocument): DesignDocument =>
  typeof structuredClone === "function"
    ? structuredClone(d)
    : (JSON.parse(JSON.stringify(d)) as DesignDocument);

const bump = (d: DesignDocument): DesignDocument => {
  d.revision = (d.revision ?? 1) + 1;
  return d;
};

export const isContainer = (type: NodeType): boolean => CONTAINER_TYPES.includes(type);

export function parentId(doc: DesignDocument, id: NodeId): NodeId | null {
  for (const n of Object.values(doc.nodes)) if (n.children?.includes(id)) return n.id;
  return null;
}

/** 새 잎 노드 — 타입별 기본 props. */
export function newLeaf(type: NodeType): DocNode {
  const id = newId("c");
  const base: Partial<StyleProps> = {};
  const props: Record<string, unknown> = {};
  switch (type) {
    case "heading":
      props.level = 2;
      props.text = "제목";
      break;
    case "text":
      props.html = "내용을 입력하세요.";
      break;
    case "button":
      props.label = "버튼";
      props.variant = "primary";
      break;
    case "image":
      props.src = "/images/demo/demo-hero.jpg";
      props.alt = "";
      break;
    case "card":
      props.title = "카드 제목";
      props.body = "카드 설명";
      break;
    case "list":
      props.ordered = false;
      props.items = ["항목 1", "항목 2"];
      break;
    case "spacer":
      props.size = 4;
      break;
    default:
      break;
  }
  return { id, type, props, style: { base } };
}

/** 새 컨테이너(섹션/컨테이너) — flex 세로 기본. */
export function newContainer(type: "section" | "container" = "container"): DocNode {
  return {
    id: newId(type === "section" ? "sec" : "box"),
    type,
    style: { base: { display: "flex", direction: "column", gap: 3, paddingY: type === "section" ? 8 : 0 } },
    children: [],
  };
}

/** parent의 index 위치에 노드 삽입(이미 nodes에 있어도 됨). */
export function insertNode(
  doc: DesignDocument,
  parent: NodeId,
  node: DocNode,
  index?: number,
): DesignDocument {
  const d = cloneDoc(doc);
  const p = d.nodes[parent];
  if (!p || !isContainer(p.type)) return doc;
  d.nodes[node.id] = node;
  p.children = p.children ?? [];
  const i = index == null ? p.children.length : Math.max(0, Math.min(index, p.children.length));
  p.children.splice(i, 0, node.id);
  return bump(d);
}

/** 노드 + 모든 자손 제거. 루트는 제거 불가. */
export function removeNode(doc: DesignDocument, id: NodeId): DesignDocument {
  if (id === doc.root) return doc;
  const d = cloneDoc(doc);
  const pid = parentId(d, id);
  if (pid && d.nodes[pid]?.children) {
    d.nodes[pid].children = d.nodes[pid].children!.filter((c) => c !== id);
  }
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    const n = d.nodes[cur];
    if (n?.children) stack.push(...n.children);
    delete d.nodes[cur];
  }
  return bump(d);
}

export function updateProps(doc: DesignDocument, id: NodeId, patch: Record<string, unknown>): DesignDocument {
  const d = cloneDoc(doc);
  const n = d.nodes[id];
  if (!n) return doc;
  n.props = { ...(n.props ?? {}), ...patch };
  return bump(d);
}

export function updateStyle(
  doc: DesignDocument,
  id: NodeId,
  device: keyof Responsive<StyleProps>,
  patch: Partial<StyleProps>,
): DesignDocument {
  const d = cloneDoc(doc);
  const n = d.nodes[id];
  if (!n) return doc;
  const st = n.style ?? { base: {} };
  st[device] = { ...(st[device] ?? {}), ...patch };
  // 값이 undefined/null인 키는 제거(초기화 지원).
  const layer = st[device] as Record<string, unknown>;
  for (const k of Object.keys(layer)) if (layer[k] == null) delete layer[k];
  n.style = st;
  return bump(d);
}

export function toggleLock(doc: DesignDocument, id: NodeId): DesignDocument {
  const d = cloneDoc(doc);
  const n = d.nodes[id];
  if (!n) return doc;
  n.locked = !n.locked;
  return bump(d);
}

/** 같은 부모 안에서 자식 순서 이동(dir -1/1). */
export function moveChild(doc: DesignDocument, id: NodeId, dir: -1 | 1): DesignDocument {
  const d = cloneDoc(doc);
  const pid = parentId(d, id);
  const p = pid ? d.nodes[pid] : null;
  if (!p?.children) return doc;
  const i = p.children.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= p.children.length) return doc;
  [p.children[i], p.children[j]] = [p.children[j], p.children[i]];
  return bump(d);
}

/** 노드를 다른 컨테이너로 이동. */
export function reparent(doc: DesignDocument, id: NodeId, newParent: NodeId, index?: number): DesignDocument {
  if (id === doc.root || id === newParent) return doc;
  const np = doc.nodes[newParent];
  if (!np || !isContainer(np.type)) return doc;
  // 자기 자손으로 이동 방지
  const descendants = new Set<NodeId>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    descendants.add(cur);
    const n = doc.nodes[cur];
    if (n?.children) stack.push(...n.children);
  }
  if (descendants.has(newParent)) return doc;

  const d = cloneDoc(doc);
  const pid = parentId(d, id);
  if (pid && d.nodes[pid]?.children) d.nodes[pid].children = d.nodes[pid].children!.filter((c) => c !== id);
  const target = d.nodes[newParent];
  target.children = target.children ?? [];
  const i = index == null ? target.children.length : Math.max(0, Math.min(index, target.children.length));
  target.children.splice(i, 0, id);
  return bump(d);
}

/** 서브트리 깊은 복제(새 id) → 원본 바로 뒤에 삽입. 새 선택 id 반환. */
export function duplicateNode(doc: DesignDocument, id: NodeId): { doc: DesignDocument; newId: NodeId } {
  if (id === doc.root) return { doc, newId: id };
  const d = cloneDoc(doc);
  const map = new Map<NodeId, NodeId>();
  const copy = (srcId: NodeId): NodeId => {
    const src = d.nodes[srcId];
    const nid = newId(src.type.slice(0, 3));
    map.set(srcId, nid);
    const children = src.children?.map((c) => copy(c));
    d.nodes[nid] = { ...structuredClone(src), id: nid, children };
    return nid;
  };
  const rootCopy = copy(id);
  const pid = parentId(d, id);
  if (pid && d.nodes[pid]?.children) {
    const i = d.nodes[pid].children!.indexOf(id);
    d.nodes[pid].children!.splice(i + 1, 0, rootCopy);
  }
  return { doc: bump(d), newId: rootCopy };
}
