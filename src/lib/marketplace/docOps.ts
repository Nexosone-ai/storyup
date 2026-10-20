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

// ---------------- 디자인 시스템: 재사용 컴포넌트 / 연결 인스턴스 ----------------

/** 특정 노드맵에서 rootId 서브트리의 모든 노드 id를 수집. */
function subtreeIds(nodes: Record<NodeId, DocNode>, rootId: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (!nodes[cur]) continue;
    out.push(cur);
    if (nodes[cur].children) stack.push(...nodes[cur].children!);
  }
  return out;
}

/** 서브트리를 새 id로 깊은 복제 → {nodes, root}. */
function copySubtree(
  srcNodes: Record<NodeId, DocNode>,
  srcRoot: NodeId,
): { nodes: Record<NodeId, DocNode>; root: NodeId } {
  const nodes: Record<NodeId, DocNode> = {};
  const copy = (sid: NodeId): NodeId => {
    const src = srcNodes[sid];
    const nid = newId(src.type.slice(0, 3));
    const children = src.children?.map((c) => copy(c));
    nodes[nid] = { ...structuredClone(src), id: nid, children };
    return nid;
  };
  return { nodes, root: copy(srcRoot) };
}

/**
 * 선택 노드를 '재사용 컴포넌트'로 승격 — 서브트리를 doc.components로 옮기고
 * 그 자리에 연결 인스턴스를 둔다. 이후 원본을 고치면 모든 인스턴스에 반영된다.
 */
export function defineComponent(
  doc: DesignDocument,
  nodeId: NodeId,
  name = "컴포넌트",
): { doc: DesignDocument; compId: string; instanceId: NodeId } {
  if (nodeId === doc.root || doc.nodes[nodeId]?.type === "instance")
    return { doc, compId: "", instanceId: nodeId };
  const d = cloneDoc(doc);
  const ids = subtreeIds(d.nodes, nodeId);
  const defNodes: Record<NodeId, DocNode> = {};
  for (const id of ids) {
    defNodes[id] = d.nodes[id];
    delete d.nodes[id];
  }
  const compId = newId("cmp");
  d.components = d.components ?? {};
  d.components[compId] = { id: compId, name, root: nodeId, nodes: defNodes };

  // 원본 자리에 인스턴스 배치.
  const instId = newId("inst");
  const inst: DocNode = { id: instId, type: "instance", componentRef: compId };
  const pid = parentId(d, nodeId); // 이미 nodes에서 제거됐으니 부모의 children만 존재
  // parentId는 nodes 기준이라 못 찾음 → 부모를 직접 탐색.
  let parent: NodeId | null = null;
  for (const n of Object.values(d.nodes)) {
    if (n.children?.includes(nodeId)) {
      parent = n.id;
      break;
    }
  }
  void pid;
  if (!parent) return { doc, compId: "", instanceId: nodeId };
  d.nodes[instId] = inst;
  const arr = d.nodes[parent].children!;
  arr.splice(arr.indexOf(nodeId), 1, instId);
  return { doc: bump(d), compId, instanceId: instId };
}

/** 컴포넌트 인스턴스를 parent에 삽입. */
export function insertInstance(doc: DesignDocument, parent: NodeId, compId: string): { doc: DesignDocument; instanceId: NodeId } {
  if (!doc.components?.[compId]) return { doc, instanceId: "" };
  const inst: DocNode = { id: newId("inst"), type: "instance", componentRef: compId };
  return { doc: insertNode(doc, parent, inst), instanceId: inst.id };
}

/** 인스턴스의 콘텐츠 오버라이드(슬롯키→props). */
export function setInstanceOverride(
  doc: DesignDocument,
  instanceId: NodeId,
  slot: string,
  patch: Record<string, unknown>,
): DesignDocument {
  const d = cloneDoc(doc);
  const n = d.nodes[instanceId];
  if (!n || n.type !== "instance") return doc;
  n.overrides = n.overrides ?? {};
  n.overrides[slot] = { ...(n.overrides[slot] ?? {}), ...patch };
  return bump(d);
}

/** 인스턴스를 '분리' — 원본의 복사본(새 id)을 인라인하고 오버라이드를 적용. */
export function detachInstance(doc: DesignDocument, instanceId: NodeId): { doc: DesignDocument; newId: NodeId } {
  const inst = doc.nodes[instanceId];
  const def = inst?.componentRef ? doc.components?.[inst.componentRef] : undefined;
  if (!inst || inst.type !== "instance" || !def) return { doc, newId: instanceId };
  const d = cloneDoc(doc);
  const { nodes: copied, root } = copySubtree(def.nodes, def.root);
  // 오버라이드 적용(슬롯 매칭).
  for (const node of Object.values(copied)) {
    if (node.slot && inst.overrides?.[node.slot]) {
      node.props = { ...(node.props ?? {}), ...inst.overrides[node.slot] };
    }
  }
  Object.assign(d.nodes, copied);
  // 인스턴스 자리에 복사 루트 삽입, 인스턴스 제거.
  let parent: NodeId | null = null;
  for (const n of Object.values(d.nodes)) {
    if (n.children?.includes(instanceId)) {
      parent = n.id;
      break;
    }
  }
  if (parent) {
    const arr = d.nodes[parent].children!;
    arr.splice(arr.indexOf(instanceId), 1, root);
  }
  delete d.nodes[instanceId];
  return { doc: bump(d), newId: root };
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
